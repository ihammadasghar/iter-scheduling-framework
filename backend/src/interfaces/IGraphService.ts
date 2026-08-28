// Placeholder interface for the Memgraph graph computation layer.
// Concrete implementation will be added in the Memgraph service ticket.

import type {
  ScheduleClass,
  Conflict,
  Constraint,
  MetricResult,
  MetricRule,
  Suggestion,
  RoomAvailability,
  WeightedScoreResult,
} from '../types/domain.js';

export interface IGraphService {
  hydrate(simulationId: string, scheduleJson: string): Promise<void>;
  flush(simulationId: string): Promise<void>;
  exportScheduleJson(simulationId: string): Promise<string>;
  listClasses(simulationId: string, page: number, limit: number): Promise<readonly ScheduleClass[]>;
  countClasses(simulationId: string): Promise<number>;
  updateClass(simulationId: string, classId: string, patch: Partial<ScheduleClass>): Promise<ScheduleClass>;
  getSuggestions(simulationId: string, classId: string): Promise<readonly Suggestion[]>;
  getRoomAvailability(simulationId: string, classId: string): Promise<readonly RoomAvailability[]>;
  queryConflicts(simulationId: string): Promise<readonly Conflict[]>;
  // Institution-authored policy constraints (consecutive_limit/gap_limit),
  // evaluated separately from the always-on structural checks in
  // queryConflicts — see ConstraintTranslator.ts.
  queryConstraintViolations(
    simulationId: string,
    constraints: readonly Constraint[],
  ): Promise<readonly Conflict[]>;
  evaluateMetrics(simulationId: string, rules: readonly MetricRule[]): Promise<readonly MetricResult[]>;
  scoreTimetable(simulationId: string, rules: readonly MetricRule[]): Promise<WeightedScoreResult>;
}
