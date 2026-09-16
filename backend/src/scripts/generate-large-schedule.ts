import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { stringifyScheduleJson } from '../utils/ScheduleHydrator.js';
import type {
  ScheduleJson,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawTimeSlot,
  RawClass,
} from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';
import { FIRST_NAMES, LAST_NAMES, ISCTE_PROGRAMS } from './nameCatalog.js';
import { loadIsteRoomCatalog, padded } from './isteRoomCatalog.js';
import { deriveCourseCode } from './courseCode.js';

// ── Scale constants ──────────────────────────────────────────────────────────
// Capacity math: 25 time slots require rooms >= 60 and studentGroups >= 60 to
// place 1500 classes without a ROOM_DOUBLE_BOOK or GROUP_OVERLAP conflict.
// 80 of each gives a realistic ~75% target utilization with margin. Rooms
// and department/course/group vocabulary are real ISCTE data (see
// isteRoomCatalog.ts and nameCatalog.ts's ISCTE_PROGRAMS) — only the class
// scale and placement are synthetic, so this stays a controllable-size
// dataset instead of the real import's full, uncurated ~5,700-class scale.

const PROFESSORS_PER_DEPT = 4;
const GROUPS_PER_DEPT = 4;
const COURSES_PER_DEPT = 8;
const NUM_ROOMS = 80;
const TARGET_CLASSES = 1500;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_CODES: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI',
};
const PERIODS = [
  { startTime: '08:30', endTime: '10:00' },
  { startTime: '10:15', endTime: '11:45' },
  { startTime: '12:00', endTime: '13:30' },
  { startTime: '13:45', endTime: '15:15' },
  { startTime: '15:30', endTime: '17:00' },
];

// ── Master data generation ───────────────────────────────────────────────────

function buildTimeSlots(): RawTimeSlot[] {
  const slots: RawTimeSlot[] = [];
  for (const day of DAYS) {
    for (const period of PERIODS) {
      const id = `TS_${DAY_CODES[day]}_${period.startTime.replace(':', '')}_${period.endTime.replace(':', '')}`;
      slots.push({
        id,
        day,
        name: `${period.startTime}–${period.endTime}`,
        startTime: period.startTime,
        endTime: period.endTime,
      });
    }
  }
  return slots;
}

interface DeptEntities {
  readonly professors: readonly RawProfessor[];
  readonly studentGroups: readonly RawStudentGroup[];
  readonly courses: readonly RawCourse[];
}

function buildDepartmentEntities(): DeptEntities[] {
  const codeCounts = new Map<string, number>();
  return ISCTE_PROGRAMS.map((program, deptIndex) => {
    const professors: RawProfessor[] = Array.from({ length: PROFESSORS_PER_DEPT }, (_, i) => {
      const globalIndex = deptIndex * PROFESSORS_PER_DEPT + i;
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[globalIndex % LAST_NAMES.length]!;
      const title = i % 2 === 0 ? 'Dr.' : 'Prof.';
      return {
        id: padded('PRF_', globalIndex, 5),
        name: `${title} ${firstName} ${lastName}`,
        department: program.code,
      };
    });

    const studentGroups: RawStudentGroup[] = Array.from({ length: GROUPS_PER_DEPT }, (_, i) => {
      const globalIndex = deptIndex * GROUPS_PER_DEPT + i;
      return {
        id: padded('GRP_', globalIndex, 5),
        name: program.turmas[i % program.turmas.length]!,
        size: 20 + (i % 4) * 10,
      };
    });

    const courses: RawCourse[] = Array.from({ length: COURSES_PER_DEPT }, (_, i) => {
      const globalIndex = deptIndex * COURSES_PER_DEPT + i;
      const name = program.courses[i % program.courses.length]!;
      return {
        id: padded('CRS_', globalIndex, 4),
        code: deriveCourseCode(name, codeCounts),
        name,
        department: program.code,
      };
    });

    return { professors, studentGroups, courses };
  });
}

// ── Class placement ──────────────────────────────────────────────────────────

function buildClasses(
  deptEntities: readonly DeptEntities[],
  rooms: readonly { id: string }[],
  timeSlots: readonly RawTimeSlot[],
): RawClass[] {
  const allCourses = deptEntities.flatMap((d, deptIndex) =>
    d.courses.map((course) => ({ course, deptIndex })),
  );

  const roomSlotPairs: Array<{ roomId: string; timeSlotId: string }> = [];
  for (const room of rooms) {
    for (const slot of timeSlots) {
      roomSlotPairs.push({ roomId: room.id, timeSlotId: slot.id });
    }
  }

  const occupiedRoomSlot = new Set<string>();
  const occupiedProfSlot = new Set<string>();
  const occupiedGroupSlot = new Set<string>();
  const deptSectionCounter: number[] = new Array(deptEntities.length).fill(0);

  const classes: RawClass[] = [];

  for (let i = 0; i < TARGET_CLASSES; i++) {
    const { course, deptIndex } = allCourses[i % allCourses.length]!;
    const dept = deptEntities[deptIndex]!;

    const sectionIndex = deptSectionCounter[deptIndex]!;
    deptSectionCounter[deptIndex] = sectionIndex + 1;

    const professor = dept.professors[sectionIndex % dept.professors.length]!;
    const group = dept.studentGroups[sectionIndex % dept.studentGroups.length]!;
    const sectionLetter = String.fromCharCode(65 + (sectionIndex % 26));

    let placed: { roomId: string; timeSlotId: string } | null = null;
    for (let attempt = 0; attempt < roomSlotPairs.length; attempt++) {
      const candidate = roomSlotPairs[(i + attempt) % roomSlotPairs.length]!;
      const roomKey = `${candidate.roomId}::${candidate.timeSlotId}`;
      const profKey = `${professor.id}::${candidate.timeSlotId}`;
      const groupKey = `${group.id}::${candidate.timeSlotId}`;

      if (
        !occupiedRoomSlot.has(roomKey) &&
        !occupiedProfSlot.has(profKey) &&
        !occupiedGroupSlot.has(groupKey)
      ) {
        occupiedRoomSlot.add(roomKey);
        occupiedProfSlot.add(profKey);
        occupiedGroupSlot.add(groupKey);
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      throw new Error(
        `Could not find a conflict-free (room, timeSlot) for class ${i + 1} of '${course.name}' — ` +
        'increase NUM_ROOMS/GROUPS_PER_DEPT or reduce TARGET_CLASSES.',
      );
    }

    classes.push({
      id: padded('CLS_', i, 6),
      courseId: course.id,
      title: `${course.name} - Section ${sectionLetter}`,
      professorId: professor.id,
      studentGroupId: group.id,
      roomId: placed.roomId,
      timeSlotIds: [placed.timeSlotId],
    });
  }

  return classes;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

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
        target: 'Room', violationCondition: 'double_booking',
      },
    ],
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

export function generateLargeSchedule(): { schedule: ScheduleJson; rules: RulesJson } {
  const rooms = loadIsteRoomCatalog().rooms.slice(0, NUM_ROOMS);
  const timeSlots = buildTimeSlots();
  const deptEntities = buildDepartmentEntities();
  const classes = buildClasses(deptEntities, rooms, timeSlots);

  const schedule: ScheduleJson = {
    metadata: {
      semesterId: 'FALL_2026',
      semesterName: 'Fall Semester 2026',
      academicYear: '2026-2027',
      versioning: {
        lastModifiedBy: 'generate-large-schedule@iter-scheduling.local',
        lastModifiedAt: '2026-07-23T00:00:00.000Z',
        schemaVersion: '1.0.0',
      },
    },
    timeSlots,
    rooms,
    professors: deptEntities.flatMap((d) => d.professors),
    studentGroups: deptEntities.flatMap((d) => d.studentGroups),
    courses: deptEntities.flatMap((d) => d.courses),
    classes,
  };

  return { schedule, rules: buildRules() };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function main(): void {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('Usage: tsx generate-large-schedule.ts <outDir>');
    process.exit(1);
  }

  const { schedule, rules } = generateLargeSchedule();

  mkdirSync(outDir, { recursive: true });
  // See importIsteDataset.ts's identical fix for why schedule.json must use
  // stringifyScheduleJson rather than a plain JSON.stringify here.
  writeFileSync(join(outDir, 'schedule.json'), stringifyScheduleJson(schedule));
  writeFileSync(join(outDir, 'rules.json'), JSON.stringify(rules, null, 2));

  console.log(
    `Generated ${schedule.classes.length} classes across ${schedule.rooms.length} rooms, ` +
    `${schedule.professors.length} professors, ${schedule.studentGroups.length} student groups, ` +
    `${schedule.courses.length} courses, into ${outDir}`,
  );
}

// require.main === module doesn't apply under NodeNext ESM output; compare
// the entry-point URL instead (see importIsteDataset.ts for the same fix).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
