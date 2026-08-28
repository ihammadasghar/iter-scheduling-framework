// Domain entities — mirrors backend/src/types/domain.ts, adapted for frontend use.
// All properties are readonly to enforce immutability throughout the codebase.

import type { RawClass } from './schedule';

export interface Simulation {
  readonly id: string;
  readonly branchId: string;
  readonly createdAt: string;
  readonly userId?: string;
  // The git blob SHA of `main`'s schedule.json when this simulation was
  // forked — an opaque version marker sent back on proposal submission so
  // the backend can tell whether the published schedule has since changed.
  readonly baseScheduleVersion: string;
}

export interface ScheduleClass {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly professorId: string;
  readonly studentGroupId: string;
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
}

export type ConflictType =
  | 'ROOM_DOUBLE_BOOK'
  | 'PROFESSOR_OVERLAP'
  | 'GROUP_OVERLAP'
  | 'ROOM_CAPACITY_EXCEEDED'
  // Policy constraints (institution-authored via the Rule Builder) rather
  // than the 4 structural checks above — see groupConflictsByType's
  // isPolicyViolation for how the UI tells the two kinds apart.
  | 'CONSECUTIVE_LIMIT_EXCEEDED'
  | 'GAP_LIMIT_EXCEEDED';

export interface Conflict {
  readonly id: string;
  readonly type: ConflictType;
  readonly classIds: readonly [string, string];
  readonly message: string;
}

export interface MetricResult {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly direction?: MetricDirection;
}

export interface Suggestion {
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
  readonly conflictFree: boolean;
}

// Per-room availability for a specific class: whether the room is even big
// enough for the class's student group (time-independent), and which
// individual timeslots are free of room/professor/group overlap for that
// class. Unlike Suggestion, every room appears here — even one with an
// empty freeTimeSlotIds — so "busy everywhere" can be told apart from
// "busy right now, free later".
export interface RoomAvailability {
  readonly roomId: string;
  readonly capacityOk: boolean;
  readonly freeTimeSlotIds: readonly string[];
}

export type ProposalStatus = 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED' | 'REJECTED';

export interface Proposal {
  readonly id: string;
  readonly simulationId: string;
  readonly status: ProposalStatus;
  readonly createdAt: string;
  readonly description?: string;
}

// Mirrors backend/src/types/domain.ts's MetricDirection — see its comment
// for why it's optional (absent = a two-sided target, symmetric scoring).
export type MetricDirection = 'higher_is_better' | 'lower_is_better';

export interface MetricRule {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly condition: string;
  readonly threshold: number;
  readonly weight: number;
  readonly direction?: MetricDirection;
}

export interface Constraint {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
  // Required and a positive integer when violationCondition is
  // 'consecutive_limit' or 'gap_limit'; absent otherwise.
  readonly limit?: number;
}

// A single metric rule's contribution to the composite score: how close its
// evaluated `value` is to the institution's `threshold`, on a 0–100 scale.
export interface MetricScoreBreakdown {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly weight: number;
  readonly threshold: number;
  readonly normalizedScore: number;
  readonly direction?: MetricDirection;
}

// The institution-defined weighted composite score for a timetable (0–100),
// plus the per-metric breakdown that produced it. `score` is 0 when no
// metric rules are defined.
export interface WeightedScoreResult {
  readonly score: number;
  readonly breakdown: readonly MetricScoreBreakdown[];
}

// A single field that differs between the same class on `main` vs. a
// proposal's candidate branch.
export interface ClassFieldDiff {
  readonly field: 'courseId' | 'title' | 'professorId' | 'studentGroupId' | 'roomId' | 'timeSlotIds';
  readonly before: unknown;
  readonly after: unknown;
}

export interface ChangedClass {
  readonly classId: string;
  readonly before: RawClass;
  readonly after: RawClass;
  readonly fieldChanges: readonly ClassFieldDiff[];
}

// The full set of class-level changes between two schedules, matched by id.
// Roster (rooms/professors/courses/groups/timeSlots) is not diffed here.
export interface ScheduleDiff {
  readonly added: readonly RawClass[];
  readonly removed: readonly RawClass[];
  readonly changed: readonly ChangedClass[];
}

// Which conflicts are new vs. resolved between two schedules, matched by
// each Conflict's deterministic id.
export interface ConflictDelta {
  readonly added: readonly Conflict[];
  readonly resolved: readonly Conflict[];
}

// A full comparison of a proposal's candidate branch against the published
// (`main`) schedule: scores and conflicts on both sides, the conflict delta,
// and the complete class-level change list.
export interface ScheduleComparison {
  readonly baselineScore: WeightedScoreResult;
  readonly candidateScore: WeightedScoreResult;
  readonly baselineConflicts: readonly Conflict[];
  readonly candidateConflicts: readonly Conflict[];
  readonly conflictDelta: ConflictDelta;
  readonly classDiff: ScheduleDiff;
}

export interface ProposalDetail extends Proposal {
  readonly diff: string;
  readonly userId?: string;
  readonly score: WeightedScoreResult;
  readonly comparison: ScheduleComparison;
}

export interface CiResult {
  readonly status: 'READY' | 'BLOCKED';
  readonly conflicts: readonly Conflict[];
  readonly score: WeightedScoreResult;
}
