// Raw types matching the schedule.json schema stored in GitHub.
// These are used exclusively during hydration; they are NOT domain types.

export interface RawTimeSlot {
  readonly id: string;
  readonly day: string;
  readonly name: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface RawRoom {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly building: string;
}

export interface RawProfessor {
  readonly id: string;
  readonly name: string;
  readonly department: string;
}

export interface RawStudentGroup {
  readonly id: string;
  readonly name: string;
  readonly size: number;
}

export interface RawCourse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly department: string;
}

export interface RawClass {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly professorId: string;
  readonly studentGroupId: string;
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
}

// Everything in schedule.json except the classes themselves — the master
// data (rooms/professors/courses/groups/time slots) that lets an ID be
// resolved to a human-readable name. Split out so the published (main)
// schedule can expose this roster on its own, without also shipping every
// class on every request (see ScheduleService.getRoster).
export interface ScheduleRoster {
  readonly metadata: Record<string, unknown>;
  readonly timeSlots: readonly RawTimeSlot[];
  readonly rooms: readonly RawRoom[];
  readonly professors: readonly RawProfessor[];
  readonly studentGroups: readonly RawStudentGroup[];
  readonly courses: readonly RawCourse[];
}

export interface ScheduleJson extends ScheduleRoster {
  readonly classes: readonly RawClass[];
}
