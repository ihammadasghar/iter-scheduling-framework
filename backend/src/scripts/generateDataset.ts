// Synthetic institution-scale dataset generator for the G1 performance
// benchmark (see docs/benchmark.md). Produces a `ScheduleJson` — the same
// shape `ScheduleHydrator.buildHydrationBatches` consumes — at a configurable
// scale, driven by a seeded PRNG so a given (scale, seed) pair always
// produces byte-identical output. Pure function: no I/O, no Memgraph access —
// that lives in `benchmark.ts`, which imports this module.

import type {
  ScheduleJson,
  RawTimeSlot,
  RawRoom,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawClass,
} from '../types/scheduleJson.js';

export interface GenerateDatasetOptions {
  /** Number of classes to generate — the primary scale knob. */
  readonly scale: number;
  /** PRNG seed; same (scale, seed) always yields the same dataset. */
  readonly seed?: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const PERIODS_PER_DAY = 8;
const DEPARTMENTS = [
  'Biology', 'Computer Science', 'Mathematics', 'Physics',
  'Chemistry', 'History', 'Economics', 'Engineering',
] as const;
const BUILDINGS = ['Science Hall', 'Main Building', 'Engineering Block', 'Arts Center'] as const;

// mulberry32 — small, fast, deterministic 32-bit PRNG. Good enough for
// synthetic data generation; not cryptographic.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: () => number, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[randInt(rng, 0, arr.length - 1)]!;

const padded = (prefix: string, i: number, width: number): string =>
  `${prefix}${String(i).padStart(width, '0')}`;

function buildTimeSlots(): readonly RawTimeSlot[] {
  const slots: RawTimeSlot[] = [];
  for (const day of DAYS) {
    for (let period = 1; period <= PERIODS_PER_DAY; period++) {
      const startHour = 7 + period;
      slots.push({
        id: `TS_${day.slice(0, 3).toUpperCase()}_P${period}`,
        day,
        name: `Period ${period}`,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(startHour + 1).padStart(2, '0')}:00`,
      });
    }
  }
  return slots;
}

const buildRooms = (count: number, rng: () => number): readonly RawRoom[] =>
  Array.from({ length: count }, (_, i) => ({
    id: padded('RM_', i + 1, 4),
    name: `Room ${i + 1}`,
    capacity: randInt(rng, 20, 150),
    building: pick(rng, BUILDINGS),
  }));

const buildProfessors = (count: number, rng: () => number): readonly RawProfessor[] =>
  Array.from({ length: count }, (_, i) => ({
    id: padded('PRF_', i + 1, 5),
    name: `Professor ${i + 1}`,
    department: pick(rng, DEPARTMENTS),
  }));

const buildStudentGroups = (count: number, rng: () => number): readonly RawStudentGroup[] =>
  Array.from({ length: count }, (_, i) => ({
    id: padded('GRP_', i + 1, 5),
    name: `Group ${i + 1}`,
    size: randInt(rng, 10, 200),
  }));

const buildCourses = (count: number, rng: () => number): readonly RawCourse[] =>
  Array.from({ length: count }, (_, i) => ({
    id: padded('CRS_', i + 1, 4),
    code: `C${String(i + 1).padStart(4, '0')}`,
    name: `Course ${i + 1}`,
    department: pick(rng, DEPARTMENTS),
  }));

const buildClasses = (
  scale: number,
  rng: () => number,
  courses: readonly RawCourse[],
  professors: readonly RawProfessor[],
  groups: readonly RawStudentGroup[],
  rooms: readonly RawRoom[],
  timeSlots: readonly RawTimeSlot[],
): readonly RawClass[] =>
  Array.from({ length: scale }, (_, i) => {
    const course = pick(rng, courses);
    return {
      id: padded('CLS_', i + 1, 6),
      courseId: course.id,
      title: `${course.name} — Section ${i + 1}`,
      professorId: pick(rng, professors).id,
      studentGroupId: pick(rng, groups).id,
      roomId: pick(rng, rooms).id,
      timeSlotIds: [pick(rng, timeSlots).id],
    };
  });

/**
 * Generate a synthetic, institution-scale `ScheduleJson` for the G1
 * performance benchmark. Entity counts scale with `scale` (the class count)
 * using ratios roughly modeled on a real university (~15 classes/professor,
 * ~25 classes/room, ~20 classes/group, ~40 classes/course), floored at small
 * minimums so low `scale` values (used for quick local runs) still produce a
 * sane, non-degenerate dataset.
 */
export function generateDataset(options: GenerateDatasetOptions): ScheduleJson {
  const { scale, seed = 42 } = options;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`scale must be a positive finite number, got ${scale}`);
  }
  const rng = mulberry32(seed);

  const roomCount = Math.max(10, Math.round(scale / 25));
  const professorCount = Math.max(5, Math.round(scale / 15));
  const groupCount = Math.max(5, Math.round(scale / 20));
  const courseCount = Math.max(5, Math.round(scale / 40));

  const timeSlots = buildTimeSlots();
  const rooms = buildRooms(roomCount, rng);
  const professors = buildProfessors(professorCount, rng);
  const studentGroups = buildStudentGroups(groupCount, rng);
  const courses = buildCourses(courseCount, rng);
  const classes = buildClasses(scale, rng, courses, professors, studentGroups, rooms, timeSlots);

  return {
    metadata: { generator: 'generateDataset', scale, seed },
    timeSlots,
    rooms,
    professors,
    studentGroups,
    courses,
    classes,
  };
}
