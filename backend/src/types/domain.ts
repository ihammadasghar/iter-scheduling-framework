// Shared domain types used across interfaces, services, and controllers.
// All properties are readonly to enforce immutability throughout the codebase.

import type { RawClass } from './scheduleJson.js';

export interface Simulation {
  readonly id: string;
  readonly branchId: string;
  readonly createdAt: string;
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
}

export interface Suggestion {
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
  readonly conflictFree: boolean;
}

export interface Conflict {
  readonly id: string;
  readonly type: 'ROOM_DOUBLE_BOOK' | 'PROFESSOR_OVERLAP' | 'GROUP_OVERLAP' | 'ROOM_CAPACITY_EXCEEDED';
  readonly classIds: readonly [string, string];
  readonly message: string;
}

export interface MetricResult {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
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
}

export interface MetricRule {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly condition: string;
  readonly threshold: number;
  readonly weight: number;
}

export interface CreateMetricRuleParams {
  readonly name: string;
  readonly target: string;
  readonly condition: string;
  readonly threshold: number;
  readonly weight: number;
}

export interface Constraint {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
}

export interface CreateConstraintParams {
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
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
