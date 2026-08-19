import type {
  Simulation,
  CreateSimulationParams,
  ListClassesParams,
  ListClassesResult,
  ScheduleClass,
  UpdateClassParams,
  Suggestion,
  Conflict,
  MetricResult,
  WeightedScoreResult,
} from '../types/domain.js';

export interface PreviewClassUpdateResult {
  readonly metrics: readonly MetricResult[];
  readonly score: WeightedScoreResult;
}

export interface ISimulationService {
  create(params: CreateSimulationParams): Promise<Simulation>;
  // Flushes the graph session, deletes the simulation branch, and removes it from the registry.
  delete(simulationId: string): Promise<void>;
  heartbeat(simulationId: string): Promise<void>;
  commit(simulationId: string): Promise<void>;
  listClasses(params: ListClassesParams): Promise<ListClassesResult>;
  updateClass(simulationId: string, classId: string, patch: UpdateClassParams): Promise<ScheduleClass>;
  getSuggestions(simulationId: string, classId: string): Promise<readonly Suggestion[]>;
  getConflicts(simulationId: string): Promise<readonly Conflict[]>;
  getMetrics(simulationId: string): Promise<readonly MetricResult[]>;
  getScore(simulationId: string): Promise<WeightedScoreResult>;
  previewClassUpdate(
    simulationId: string,
    classId: string,
    patch: UpdateClassParams,
  ): Promise<PreviewClassUpdateResult>;
}
