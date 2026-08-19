import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  ScheduleJson,
  RawRoom,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawTimeSlot,
  RawClass,
} from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';

// ── Scale constants ──────────────────────────────────────────────────────────
// Capacity math: 25 time slots require rooms >= 60 and studentGroups >= 60 to
// place 1500 classes without a ROOM_DOUBLE_BOOK or GROUP_OVERLAP conflict.
// 80 of each gives a realistic ~75% target utilization with margin.

const DEPARTMENTS = [
  { name: 'Biology', code: 'BIO' },
  { name: 'Chemistry', code: 'CHE' },
  { name: 'History', code: 'HIS' },
  { name: 'Mathematics', code: 'MAT' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Computer Science', code: 'COM' },
  { name: 'English', code: 'ENG' },
  { name: 'Economics', code: 'ECO' },
  { name: 'Psychology', code: 'PSY' },
  { name: 'Art', code: 'ART' },
  { name: 'Sociology', code: 'SOC' },
  { name: 'Philosophy', code: 'PHI' },
  { name: 'Geology', code: 'GEO' },
  { name: 'Statistics', code: 'STA' },
  { name: 'Political Science', code: 'POL' },
  { name: 'Music', code: 'MUS' },
  { name: 'Anthropology', code: 'ANT' },
  { name: 'Linguistics', code: 'LIN' },
  { name: 'Environmental Science', code: 'ENV' },
  { name: 'Astronomy', code: 'AST' },
] as const;

const PROFESSORS_PER_DEPT = 4;
const GROUPS_PER_DEPT = 4;
const COURSES_PER_DEPT = 8;
const NUM_ROOMS = 80;
const TARGET_CLASSES = 1500;

const FIRST_NAMES = [
  'Jane', 'Alan', 'Bob', 'Maria', 'Wei', 'Fatima', 'John', 'Priya', 'Carlos', 'Aisha',
  'David', 'Elena', 'Kenji', 'Sofia', 'Omar', 'Grace', 'Liam', 'Noor', 'Ivan', 'Mei',
];
const LAST_NAMES = ['Smith', 'Jones', 'Chen', 'Garcia', 'Khan', 'Muller', 'Kim', 'Patel', 'Silva', 'Nguyen'];
const COURSE_TEMPLATES = [
  'Introduction to', 'Advanced', 'Foundations of', 'Topics in',
  'Principles of', 'Seminar in', 'Applied', 'History of',
];
const ROOM_BUILDINGS = ['Science Hall', 'Arts Block', 'Main Hall', 'Engineering Building', 'Library Annex'];
const ROOM_CAPACITIES = [30, 40, 50, 60, 80, 100];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_CODES: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI',
};
const PERIODS = [
  { name: 'Period 1', startTime: '08:30', endTime: '10:00' },
  { name: 'Period 2', startTime: '10:15', endTime: '11:45' },
  { name: 'Period 3', startTime: '12:00', endTime: '13:30' },
  { name: 'Period 4', startTime: '13:45', endTime: '15:15' },
  { name: 'Period 5', startTime: '15:30', endTime: '17:00' },
];

// ── Master data generation ───────────────────────────────────────────────────

function buildRooms(): RawRoom[] {
  return Array.from({ length: NUM_ROOMS }, (_, i) => ({
    id: `RM_${String(101 + i).padStart(3, '0')}`,
    name: `Room ${101 + i}`,
    capacity: ROOM_CAPACITIES[i % ROOM_CAPACITIES.length]!,
    building: ROOM_BUILDINGS[i % ROOM_BUILDINGS.length]!,
  }));
}

function buildTimeSlots(): RawTimeSlot[] {
  const slots: RawTimeSlot[] = [];
  for (const day of DAYS) {
    PERIODS.forEach((period, i) => {
      slots.push({
        id: `TS_${DAY_CODES[day]}_P${i + 1}`,
        day,
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
      });
    });
  }
  return slots;
}

interface DeptEntities {
  readonly professors: readonly RawProfessor[];
  readonly studentGroups: readonly RawStudentGroup[];
  readonly courses: readonly RawCourse[];
}

function buildDepartmentEntities(): DeptEntities[] {
  return DEPARTMENTS.map((dept, deptIndex) => {
    const professors: RawProfessor[] = Array.from({ length: PROFESSORS_PER_DEPT }, (_, i) => {
      const globalIndex = deptIndex * PROFESSORS_PER_DEPT + i;
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[globalIndex % LAST_NAMES.length]!;
      const title = i % 2 === 0 ? 'Dr.' : 'Prof.';
      return {
        id: `PRF_${dept.code}_${i + 1}`,
        name: `${title} ${firstName} ${lastName}`,
        department: dept.name,
      };
    });

    const studentGroups: RawStudentGroup[] = Array.from({ length: GROUPS_PER_DEPT }, (_, i) => ({
      id: `GRP_${dept.code}_Y${i + 1}`,
      name: `${dept.name} Year ${i + 1}`,
      size: 20 + (i % 4) * 10,
    }));

    const courses: RawCourse[] = Array.from({ length: COURSES_PER_DEPT }, (_, i) => ({
      id: `CRS_${dept.code}_${101 + i}`,
      code: `${dept.code}${101 + i}`,
      name: `${COURSE_TEMPLATES[i % COURSE_TEMPLATES.length]} ${dept.name}`,
      department: dept.name,
    }));

    return { professors, studentGroups, courses };
  });
}

// ── Class placement ──────────────────────────────────────────────────────────

function buildClasses(
  deptEntities: readonly DeptEntities[],
  rooms: readonly RawRoom[],
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
      id: `CLS_${String(i + 1).padStart(5, '0')}`,
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
  const rooms = buildRooms();
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
  writeFileSync(join(outDir, 'schedule.json'), JSON.stringify(schedule, null, 2));
  writeFileSync(join(outDir, 'rules.json'), JSON.stringify(rules, null, 2));

  console.log(
    `Generated ${schedule.classes.length} classes across ${schedule.rooms.length} rooms, ` +
    `${schedule.professors.length} professors, ${schedule.studentGroups.length} student groups, ` +
    `${schedule.courses.length} courses, into ${outDir}`,
  );
}

if (require.main === module) {
  main();
}
