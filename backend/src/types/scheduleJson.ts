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

export interface ScheduleJson {
  readonly metadata: Record<string, unknown>;
  readonly timeSlots: readonly RawTimeSlot[];
  readonly rooms: readonly RawRoom[];
  readonly professors: readonly RawProfessor[];
  readonly studentGroups: readonly RawStudentGroup[];
  readonly courses: readonly RawCourse[];
  readonly classes: readonly RawClass[];
}
