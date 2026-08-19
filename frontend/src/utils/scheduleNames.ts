// Resolves schedule entity IDs to their real, fetched `name` (or `code`) —
// the primary label source. Falls back to the ID-parsing functions in
// scheduleFormatters.ts when the roster hasn't loaded yet or doesn't have
// that ID (stale reference), so this never renders worse than before.
import {
  formatRoomLabel,
  formatProfessorLabel,
  formatGroupLabel,
  formatCourseLabel,
} from './scheduleFormatters';
import type { RawRoom, RawProfessor, RawCourse, RawStudentGroup } from '@/types';

export interface ScheduleNames {
  readonly professorName: (id: string) => string;
  readonly courseName: (id: string) => string;
  readonly courseCode: (id: string) => string;
  readonly roomName: (id: string) => string;
  readonly groupName: (id: string) => string;
}

// Used when no roster has loaded at all — degrades to exactly today's
// ID-derived output, which is also what buildScheduleNames([], [], [], [])
// produces (see test).
export const FORMATTER_NAMES: ScheduleNames = {
  professorName: formatProfessorLabel,
  courseName: formatCourseLabel,
  courseCode: formatCourseLabel,
  roomName: formatRoomLabel,
  groupName: formatGroupLabel,
};

export const buildScheduleNames = (
  rooms: readonly RawRoom[],
  professors: readonly RawProfessor[],
  courses: readonly RawCourse[],
  studentGroups: readonly RawStudentGroup[],
): ScheduleNames => {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const professorById = new Map(professors.map((p) => [p.id, p]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const groupById = new Map(studentGroups.map((g) => [g.id, g]));

  return {
    professorName: (id) => professorById.get(id)?.name ?? formatProfessorLabel(id),
    courseName: (id) => courseById.get(id)?.name ?? formatCourseLabel(id),
    courseCode: (id) => courseById.get(id)?.code ?? formatCourseLabel(id),
    roomName: (id) => roomById.get(id)?.name ?? formatRoomLabel(id),
    groupName: (id) => groupById.get(id)?.name ?? formatGroupLabel(id),
  };
};
