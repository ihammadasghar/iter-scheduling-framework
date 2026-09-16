// Converts ISCTE's real 2022/23 1st-semester export
// (docs/ISCTE-1st-Semester-22-23-Schedule-rooms-assigned.csv +
// docs/ISCTE-Typology-Rooms.xls) into a `ScheduleJson`/`RulesJson` pair —
// the same shape `generate-large-schedule.ts` produces, so this is a
// drop-in alternative wherever that CLI contract is used. See
// docs/iscte-dataset.md for the full column glossary and the data-quality
// findings this transform works around.
//
// Source-data facts driving the choices below (see docs/iscte-dataset.md):
//  - Each row is a single calendar occurrence, not a weekly template — we
//    collapse rows into recurring weekly classes by (Turno, day, start, end).
//  - No professor/instructor column exists anywhere in the export — one
//    professor is synthesized per shift (Turno), flagged in metadata.
//  - Most shifts do get a room in this export, but ~21% of the rows that
//    have *some* value in `Sala da aula` hold corrupted scientific-notation
//    junk (e.g. "1,00E+02") rather than a real room code — a source-data
//    artifact, not a parsing bug. `pickModeRoom()` below already only
//    accepts names present in the room catalog, so these are silently
//    skipped as candidates; shifts left with no valid room keep roomId: ""
//    (the codebase's existing "no room" convention — see GraphService's
//    `coalesce(c.roomId, r.id)` / `String(c['roomId'] ?? '')`).
//  - A shift shared by several student cohorts (comma-separated `Turma`) is
//    exploded into one class per cohort, since the schema allows only one
//    `studentGroupId` per class.

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { stringifyScheduleJson } from '../utils/ScheduleHydrator.js';
import type {
  ScheduleJson,
  RawTimeSlot,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawClass,
} from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';
import { FIRST_NAMES, LAST_NAMES } from './nameCatalog.js';
import { loadIsteRoomCatalog, headerIndex, type Row } from './isteRoomCatalog.js';
import { deriveCourseCode } from './courseCode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_SOURCE = join(__dirname, '../../../docs/ISCTE-1st-Semester-22-23-Schedule-rooms-assigned.csv');

const DAY_PT_TO_EN: Record<string, string> = {
  Seg: 'Monday', Ter: 'Tuesday', Qua: 'Wednesday', Qui: 'Thursday', Sex: 'Friday', Sáb: 'Saturday',
};
const DAY_CODE: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
};

const padded = (prefix: string, i: number, width: number): string =>
  `${prefix}${String(i + 1).padStart(width, '0')}`;

// The schedule source is a plain semicolon-delimited CSV with a UTF-8 BOM
// (ISCTE's own export, not run through Excel) — no quoting/escaping to
// handle, fields never contain a literal ';'.
function readCsvRows(path: string): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(';'));
}

// Like headerIndex, but returns undefined instead of throwing when the
// column is absent — for columns that only some export shapes carry.
function headerIndexOptional(header: Row, name: string): number | undefined {
  const idx = header.indexOf(name);
  return idx === -1 ? undefined : idx;
}

// ── Schedule rows (ISCTE-1st-Semester-22-23-Schedule-rooms-assigned.csv) ──

interface ScheduleCols {
  curso: number; unidade: number; turno: number; turma: number;
  // 'Lotação total' (shift capacity) only exists in the older xlsx export —
  // this CSV instead has a same-named-looking 'Lotação' column that is
  // actually the *assigned room's* capacity (constant per room, blank
  // exactly when 'Sala da aula' is blank — verified by inspection), not a
  // shift capacity. Using it as a lotacaoTotal fallback would silently
  // corrupt student-group sizing, so it is intentionally NOT aliased here —
  // group size falls back to 'Inscritos no turno' alone when absent.
  lotacaoTotal: number | undefined;
  inscritos: number; diaSemana: number; inicio: number; fim: number; dia: number; sala: number;
}

function resolveScheduleCols(header: Row): ScheduleCols {
  return {
    curso: headerIndex(header, 'Curso'),
    unidade: headerIndex(header, 'Unidade de execução'),
    turno: headerIndex(header, 'Turno'),
    turma: headerIndex(header, 'Turma'),
    lotacaoTotal: headerIndexOptional(header, 'Lotação total'),
    inscritos: headerIndex(header, 'Inscritos no turno'),
    diaSemana: headerIndex(header, 'Dia da Semana'),
    inicio: headerIndex(header, 'Início'),
    fim: headerIndex(header, 'Fim'),
    dia: headerIndex(header, 'Dia'),
    sala: headerIndex(header, 'Sala da aula'),
  };
}

// 'Dia' cells are plain "DD/MM/YYYY" text (e.g. "02/12/2022") — parsed by
// hand into "YYYY-MM-DD" rather than via `new Date(...)`, which would parse
// in local time and risk an off-by-one day depending on the host timezone.
function parseIsoDate(cell: string | undefined): string | undefined {
  const parts = cell?.trim().split('/');
  if (!parts || parts.length !== 3) return undefined;
  const [dayStr, monthStr, yearStr] = parts;
  const month = Number(monthStr);
  const day = Number(dayStr);
  let year = Number(yearStr);
  if (!month || !day || !year) return undefined;
  if (year < 100) year += 2000;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface TurnoInfo {
  readonly unidade: string;
  readonly cursoProxy: string; // first token of 'Curso' — used as a department stand-in
}

interface ClassPattern {
  readonly turno: string;
  readonly day: string; // English
  readonly start: string;
  readonly end: string;
  readonly roomCounts: Map<string, number>; // room name -> occurrence count, for mode selection
}

interface ParsedSchedule {
  readonly turnoOrder: readonly string[];
  readonly turnoInfo: ReadonlyMap<string, TurnoInfo>;
  readonly turnoTurma: ReadonlyMap<string, string>; // raw, possibly comma-separated
  readonly patterns: readonly ClassPattern[]; // one per (turno, day, start, end)
  readonly groupSizeByToken: ReadonlyMap<string, number>;
  readonly timeSlotKeys: ReadonlySet<string>; // "day::start::end"
  readonly semesterStartDate: string; // "YYYY-MM-DD", min 'Dia' across all rows
  readonly semesterEndDate: string; // "YYYY-MM-DD", max 'Dia' across all rows
}

function parseScheduleRows(): ParsedSchedule {
  const rows = readCsvRows(SCHEDULE_SOURCE);
  const cols = resolveScheduleCols(rows[0]!);

  const turnoOrder: string[] = [];
  const turnoInfo = new Map<string, TurnoInfo>();
  const turnoTurma = new Map<string, string>();
  const patternsByKey = new Map<string, ClassPattern>();
  const groupSizeByToken = new Map<string, number>();
  const timeSlotKeys = new Set<string>();
  let semesterStartDate: string | undefined;
  let semesterEndDate: string | undefined;

  for (const row of rows.slice(1)) {
    // Tracked unconditionally (not gated on the class-construction fields
    // below) — the semester's calendar bounds should reflect every real
    // occurrence in the export, not just the rows that survive into a class.
    const isoDate = parseIsoDate(row[cols.dia]);
    if (isoDate) {
      if (!semesterStartDate || isoDate < semesterStartDate) semesterStartDate = isoDate;
      if (!semesterEndDate || isoDate > semesterEndDate) semesterEndDate = isoDate;
    }

    const turno = row[cols.turno]?.trim();
    const diaSemanaRaw = row[cols.diaSemana]?.trim();
    const day = diaSemanaRaw ? DAY_PT_TO_EN[diaSemanaRaw] : undefined;
    const start = row[cols.inicio]?.trim();
    const end = row[cols.fim]?.trim();
    const turma = row[cols.turma]?.trim();
    if (!turno || !day || !start || !end || !turma) continue; // Sunday/blank rows dropped as noise

    if (!turnoInfo.has(turno)) {
      turnoOrder.push(turno);
      const curso = row[cols.curso]?.trim() ?? '';
      turnoInfo.set(turno, {
        unidade: row[cols.unidade]?.trim() || 'Unknown Course',
        cursoProxy: curso.split(',')[0]?.trim() || 'Unknown',
      });
      turnoTurma.set(turno, turma);
    }

    const patternKey = `${turno}::${day}::${start}::${end}`;
    timeSlotKeys.add(`${day}::${start}::${end}`);
    let pattern = patternsByKey.get(patternKey);
    if (!pattern) {
      pattern = { turno, day, start, end, roomCounts: new Map() };
      patternsByKey.set(patternKey, pattern);
    }
    const room = row[cols.sala]?.trim();
    if (room) pattern.roomCounts.set(room, (pattern.roomCounts.get(room) ?? 0) + 1);

    const lotacaoTotal = cols.lotacaoTotal !== undefined ? Number(row[cols.lotacaoTotal]) || 0 : 0;
    const size = Math.max(lotacaoTotal, Number(row[cols.inscritos]) || 0);
    for (const token of turma.split(',').map((t) => t.trim()).filter(Boolean)) {
      groupSizeByToken.set(token, Math.max(groupSizeByToken.get(token) ?? 0, size));
    }
  }

  if (!semesterStartDate || !semesterEndDate) {
    throw new Error("No parseable 'Dia' dates found in the schedule export — cannot determine semester bounds");
  }

  return {
    turnoOrder,
    turnoInfo,
    turnoTurma,
    patterns: [...patternsByKey.values()],
    groupSizeByToken,
    timeSlotKeys,
    semesterStartDate,
    semesterEndDate,
  };
}

// ── Entity builders ──────────────────────────────────────────────────────

function buildTimeSlots(timeSlotKeys: ReadonlySet<string>): { slots: RawTimeSlot[]; idByKey: Map<string, string> } {
  const idByKey = new Map<string, string>();
  const slots = [...timeSlotKeys].sort().map((key) => {
    const [day, start, end] = key.split('::') as [string, string, string];
    const id = `TS_${DAY_CODE[day]}_${start.slice(0, 5).replace(':', '')}_${end.slice(0, 5).replace(':', '')}`;
    idByKey.set(key, id);
    return { id, day, name: `${start.slice(0, 5)}–${end.slice(0, 5)}`, startTime: start.slice(0, 5), endTime: end.slice(0, 5) };
  });
  return { slots, idByKey };
}

function buildCourses(turnoInfo: ReadonlyMap<string, TurnoInfo>): { courses: RawCourse[]; idByUnidade: Map<string, string> } {
  const unidades = [...new Set([...turnoInfo.values()].map((t) => t.unidade))].sort();
  const idByUnidade = new Map<string, string>();
  const codeCounts = new Map<string, number>();
  const courses = unidades.map((unidade, i) => {
    const id = padded('CRS_', i, 4);
    idByUnidade.set(unidade, id);
    // Department proxy: the first program a course was found under. ISCTE's
    // export has no department field — see docs/iscte-dataset.md.
    const department = [...turnoInfo.values()].find((t) => t.unidade === unidade)?.cursoProxy ?? 'Unknown';
    return { id, code: deriveCourseCode(unidade, codeCounts), name: unidade, department };
  });
  return { courses, idByUnidade };
}

function buildStudentGroups(groupSizeByToken: ReadonlyMap<string, number>): { groups: RawStudentGroup[]; idByToken: Map<string, string> } {
  const tokens = [...groupSizeByToken.keys()].sort();
  const idByToken = new Map<string, string>();
  const groups = tokens.map((token, i) => {
    const id = padded('GRP_', i, 5);
    idByToken.set(token, id);
    return { id, name: token, size: groupSizeByToken.get(token) || 20 };
  });
  return { groups, idByToken };
}

// One professor per shift (Turno), deterministically derived from its
// position in the sorted turno list — never from an rng() draw, so a given
// export always produces byte-identical output (mirrors generateDataset.ts's
// buildProfessors). Department is inherited from the course the shift
// teaches, so it's at least internally consistent even though the identity
// itself is fabricated.
function buildProfessors(
  turnoOrder: readonly string[],
  turnoInfo: ReadonlyMap<string, TurnoInfo>,
  idByUnidade: ReadonlyMap<string, string>,
  courses: readonly RawCourse[],
): { professors: RawProfessor[]; idByTurno: Map<string, string> } {
  const sorted = [...turnoOrder].sort();
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const idByTurno = new Map<string, string>();
  const professors = sorted.map((turno, i) => {
    const id = padded('PRF_', i, 5);
    idByTurno.set(turno, id);
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]!;
    const info = turnoInfo.get(turno)!;
    const courseId = idByUnidade.get(info.unidade);
    const department = (courseId && courseById.get(courseId)?.department) || 'Unknown';
    return { id, name: `${i % 2 === 0 ? 'Dr.' : 'Prof.'} ${firstName} ${lastName}`, department };
  });
  return { professors, idByTurno };
}

function pickModeRoom(roomCounts: ReadonlyMap<string, number>, roomIdByName: ReadonlyMap<string, string>): string {
  let best: string | undefined;
  let bestCount = 0;
  for (const [name, count] of roomCounts) {
    if (count > bestCount && roomIdByName.has(name)) {
      best = name;
      bestCount = count;
    }
  }
  return best ? roomIdByName.get(best)! : '';
}

function buildClasses(
  parsed: ParsedSchedule,
  idByUnidade: ReadonlyMap<string, string>,
  idByTurno: ReadonlyMap<string, string>,
  idByToken: ReadonlyMap<string, string>,
  timeSlotIdByKey: ReadonlyMap<string, string>,
  roomIdByName: ReadonlyMap<string, string>,
): RawClass[] {
  const classes: RawClass[] = [];
  const sortedPatterns = [...parsed.patterns].sort(
    (a, b) => a.turno.localeCompare(b.turno) || a.day.localeCompare(b.day) || a.start.localeCompare(b.start),
  );

  for (const pattern of sortedPatterns) {
    const info = parsed.turnoInfo.get(pattern.turno)!;
    const courseId = idByUnidade.get(info.unidade)!;
    const professorId = idByTurno.get(pattern.turno)!;
    const roomId = pickModeRoom(pattern.roomCounts, roomIdByName);
    const timeSlotId = timeSlotIdByKey.get(`${pattern.day}::${pattern.start}::${pattern.end}`)!;
    const turmaRaw = parsed.turnoTurma.get(pattern.turno)!;
    const groupTokens = turmaRaw.split(',').map((t) => t.trim()).filter(Boolean);

    // A shift shared by several cohorts is exploded into one class per
    // cohort — same room/time/professor, different studentGroupId — since
    // the schema allows only one group per class.
    for (const token of groupTokens) {
      const studentGroupId = idByToken.get(token);
      if (!studentGroupId) continue;
      classes.push({
        id: padded('CLS_', classes.length, 6),
        courseId,
        title: `${info.unidade} (${pattern.turno})`,
        professorId,
        studentGroupId,
        roomId,
        timeSlotIds: [timeSlotId],
      });
    }
  }

  return classes;
}

function buildRules(): RulesJson {
  return {
    metrics: [
      {
        id: 'metric-room-utilization', name: 'Room Utilization',
        target: 'Room', condition: 'utilization', threshold: 80, weight: 1,
      },
      {
        id: 'metric-avg-classes-per-professor', name: 'Average Classes per Professor per Day',
        target: 'Professor', condition: 'avg_classes_per_day', threshold: 4, weight: 1,
      },
    ],
    constraints: [
      {
        id: 'constraint-no-room-double-booking', name: 'No Room Double Booking',
        target: 'Room', violationCondition: 'room_double_book',
      },
    ],
  };
}

// ── Public entry point ───────────────────────────────────────────────────

export function importIsteDataset(): { schedule: ScheduleJson; rules: RulesJson } {
  const { rooms, roomIdByName } = loadIsteRoomCatalog();
  const parsed = parseScheduleRows();
  const { slots: timeSlots, idByKey: timeSlotIdByKey } = buildTimeSlots(parsed.timeSlotKeys);
  const { courses, idByUnidade } = buildCourses(parsed.turnoInfo);
  const { groups: studentGroups, idByToken } = buildStudentGroups(parsed.groupSizeByToken);
  const { professors, idByTurno } = buildProfessors(parsed.turnoOrder, parsed.turnoInfo, idByUnidade, courses);
  const classes = buildClasses(parsed, idByUnidade, idByTurno, idByToken, timeSlotIdByKey, roomIdByName);

  const classesWithRoom = classes.filter((c) => c.roomId !== '').length;

  const schedule: ScheduleJson = {
    metadata: {
      source: 'iscte-2022-23',
      semesterId: 'ISCTE_2022_2023_S1',
      semesterName: '1st Semester 2022/2023',
      academicYear: '2022/2023',
      professorsAreSynthetic: true,
      roomCoverage: `${classesWithRoom}/${classes.length} classes have a real assigned room`,
      // Required by the frontend's week-navigation (see weekNavigation.ts's
      // clampWeekStart) — bounds are the min/max 'Dia' seen anywhere in the
      // export, not hardcoded. exclusionDates is empty: ISCTE's export has
      // no explicit holiday/break field to derive it from.
      timeline: {
        semesterStartDate: parsed.semesterStartDate,
        semesterEndDate: parsed.semesterEndDate,
        exclusionDates: [],
      },
      versioning: {
        lastModifiedBy: 'importIsteDataset@iter-scheduling.local',
        // Fixed, not `new Date()` — the source files are static, so
        // re-running this import must produce byte-identical output (see
        // the determinism test).
        lastModifiedAt: '2023-01-06T00:00:00.000Z',
        schemaVersion: '1.0.0',
      },
    },
    timeSlots,
    rooms,
    professors,
    studentGroups,
    courses,
    classes,
  };

  return { schedule, rules: buildRules() };
}

// ── CLI entry point ──────────────────────────────────────────────────────

function main(): void {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('Usage: tsx importIsteDataset.ts <outDir>');
    process.exit(1);
  }

  const { schedule, rules } = importIsteDataset();

  mkdirSync(outDir, { recursive: true });
  // schedule.json must use the same one-record-per-line serialization the
  // app itself writes on every commit (stringifyScheduleJson) — a plain
  // JSON.stringify(..., null, 2) here left `main`'s stored text permanently
  // reformatted differently from any simulation branch (which always goes
  // through stringifyScheduleJson on commit), which turned every proposal's
  // line-based diff into a near-total rewrite instead of a localized one.
  // Measured cost against the full ISCTE dataset: ~34s per diff generation,
  // found while auditing session readiness for live cognitive-walkthrough
  // testing — see docs/iscte-dataset.md.
  writeFileSync(join(outDir, 'schedule.json'), stringifyScheduleJson(schedule));
  writeFileSync(join(outDir, 'rules.json'), JSON.stringify(rules, null, 2));

  console.log(
    `Imported ${schedule.classes.length} classes across ${schedule.rooms.length} rooms, ` +
    `${schedule.professors.length} synthesized professors, ${schedule.studentGroups.length} student groups, ` +
    `${schedule.courses.length} courses, ${schedule.timeSlots.length} time slots, into ${outDir}. ` +
    `(${schedule.metadata['roomCoverage']})`,
  );
}

// require.main === module doesn't apply under NodeNext ESM output; compare
// the entry-point URL instead.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
