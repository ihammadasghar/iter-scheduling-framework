// Shared domain types used across interfaces, services, and controllers.
// All properties are readonly to enforce immutability throughout the codebase.

import type { RawClass } from './scheduleJson.js';

export interface Simulation {
  readonly id: string;
  readonly branchId: string;
  readonly createdAt: string;
  // The git blob SHA of `main`'s schedule.json at the moment this
  // simulation branch was forked — an opaque version marker used to detect
  // whether `main` has moved since (see ProposalService.submit's staleness
  // check and SimulationService.rebase).
  readonly baseScheduleVersion: string;
}

export interface CreateSimulationParams {
  readonly userId: string;
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

export interface ListClassesParams {
  readonly simulationId: string;
  readonly page: number;
  readonly limit: number;
}

export interface ListClassesResult {
  readonly data: readonly ScheduleClass[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface UpdateClassParams {
  readonly professorId?: string;
  readonly roomId?: string;
  readonly timeSlotIds?: readonly string[];
  readonly studentGroupId?: string;
}

export interface Suggestion {
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
  readonly conflictFree: boolean;
}

// Per-room availability for a specific class: whether the room is even big
// enough for the class's student group (time-independent), and which
// individual timeslots are free of room/professor/group overlap for that
// class. Unlike Suggestion, every room in the branch appears here — even one
// with an empty freeTimeSlotIds — so "busy everywhere" can be told apart
// from "busy right now, free later".
export interface RoomAvailability {
  readonly roomId: string;
  readonly capacityOk: boolean;
  readonly freeTimeSlotIds: readonly string[];
}

export interface Conflict {
  readonly id: string;
  readonly type:
    | 'ROOM_DOUBLE_BOOK'
    | 'PROFESSOR_OVERLAP'
    | 'GROUP_OVERLAP'
    | 'ROOM_CAPACITY_EXCEEDED'
    // Policy constraints (institution-authored via the Rule Builder,
    // evaluated by GraphService.queryConstraintViolations) rather than the
    // 4 hardcoded structural checks above (queryConflicts). Both kinds
    // share this same Conflict shape so downstream code — CI decisioning,
    // the proposal review UI — doesn't need a second violation model.
    | 'CONSECUTIVE_LIMIT_EXCEEDED'
    | 'GAP_LIMIT_EXCEEDED';
  readonly classIds: readonly [string, string];
  readonly message: string;
}

export interface MetricResult {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly direction?: MetricDirection;
}

export interface Proposal {
  readonly id: string;
  readonly simulationId: string;
  readonly status: 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED' | 'REJECTED';
  readonly createdAt: string;
}

export interface CreateProposalParams {
  readonly simulationId: string;
  readonly description: string;
  // The simulation's baseScheduleVersion at the time the client is
  // submitting — compared against main's current schedule.json SHA to
  // detect a draft that's gone stale (see ProposalService.submit).
  readonly baseScheduleVersion: string;
}

// Result of rebasing a simulation's draft onto the latest published
// schedule (see SimulationService.rebase).
export interface RebaseResult {
  readonly baseScheduleVersion: string;
}

// Whether a metric's value should be pushed up or down toward its
// threshold — absent for a genuinely two-sided target (e.g. "close to this
// exact count"), where scoreTimetable() falls back to today's symmetric
// distance-from-threshold scoring. See GraphService.scoreTimetable.
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

export interface CreateMetricRuleParams {
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
  // Required and must be a positive integer when violationCondition is
  // 'consecutive_limit' or 'gap_limit'; absent for the other 4 conditions.
  // See RulesService.createConstraint for the validation that enforces this.
  readonly limit?: number;
}

export interface CreateConstraintParams {
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
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

export interface CiResult {
  readonly status: 'READY' | 'BLOCKED';
  readonly conflicts: readonly Conflict[];
  readonly score: WeightedScoreResult;
}

// A single field that differs between the same class on `main` vs. a
// proposal's candidate branch. `field` is any RawClass field except `id`
// (which is how the two sides were matched in the first place).
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

// The full set of class-level changes between two schedules, computed by
// comparing their `classes` arrays by id (see utils/ScheduleDiffer.ts).
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
  readonly score: WeightedScoreResult;
  readonly comparison: ScheduleComparison;
}
