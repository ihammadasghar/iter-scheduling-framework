// Shared domain types used across interfaces, services, and controllers.
// All properties are readonly to enforce immutability throughout the codebase.

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
  readonly type: 'ROOM_DOUBLE_BOOK' | 'PROFESSOR_OVERLAP' | 'GROUP_OVERLAP';
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
  readonly status: 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED';
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
}

export interface CreateMetricRuleParams {
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

export interface CreateConstraintParams {
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
}

export interface CiResult {
  readonly status: 'READY' | 'BLOCKED';
  readonly conflicts: readonly Conflict[];
}
