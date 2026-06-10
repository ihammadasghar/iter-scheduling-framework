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
} from '../types/domain.js';

export interface ISimulationService {
  create(params: CreateSimulationParams): Promise<Simulation>;
  heartbeat(simulationId: string): Promise<void>;
  commit(simulationId: string): Promise<void>;
  listClasses(params: ListClassesParams): Promise<ListClassesResult>;
  updateClass(simulationId: string, classId: string, patch: UpdateClassParams): Promise<ScheduleClass>;
  getSuggestions(simulationId: string, classId: string): Promise<readonly Suggestion[]>;
  getConflicts(simulationId: string): Promise<readonly Conflict[]>;
  getMetrics(simulationId: string): Promise<readonly MetricResult[]>;
}
