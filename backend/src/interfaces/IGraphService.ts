// Placeholder interface for the Memgraph graph computation layer.
// Concrete implementation will be added in the Memgraph service ticket.

import type { ScheduleClass, Conflict, MetricResult, MetricRule, Suggestion } from '../types/domain.js';

export interface IGraphService {
  hydrate(simulationId: string, scheduleJson: string): Promise<void>;
  flush(simulationId: string): Promise<void>;
  exportScheduleJson(simulationId: string): Promise<string>;
  listClasses(simulationId: string, page: number, limit: number): Promise<readonly ScheduleClass[]>;
  countClasses(simulationId: string): Promise<number>;
  updateClass(simulationId: string, classId: string, patch: Partial<ScheduleClass>): Promise<ScheduleClass>;
  getSuggestions(simulationId: string, classId: string): Promise<readonly Suggestion[]>;
  queryConflicts(simulationId: string): Promise<readonly Conflict[]>;
  evaluateMetrics(simulationId: string, rules: readonly MetricRule[]): Promise<readonly MetricResult[]>;
}
