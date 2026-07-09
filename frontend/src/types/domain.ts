// Domain entities — mirrors backend/src/types/domain.ts, adapted for frontend use.
// All properties are readonly to enforce immutability throughout the codebase.

export interface Simulation {
  readonly id: string;
  readonly branchId: string;
  readonly createdAt: string;
  readonly userId?: string;
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

export type ConflictType = 'ROOM_DOUBLE_BOOK' | 'PROFESSOR_OVERLAP' | 'GROUP_OVERLAP';

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
}

export interface Suggestion {
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
  readonly conflictFree: boolean;
}

export type ProposalStatus = 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED' | 'REJECTED';

export interface Proposal {
  readonly id: string;
  readonly simulationId: string;
  readonly status: ProposalStatus;
  readonly createdAt: string;
  readonly description?: string;
}

export interface ProposalDetail extends Proposal {
  readonly diff: string;
  readonly userId?: string;
}

export interface MetricRule {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly condition: string;
  readonly threshold: number;
}

export interface Constraint {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
}

export interface CiResult {
  readonly status: 'READY' | 'BLOCKED';
  readonly conflicts: readonly Conflict[];
}
