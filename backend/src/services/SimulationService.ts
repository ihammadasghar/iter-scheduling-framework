import { ApiError } from '../types/ApiError.js';
import type { ISimulationService } from '../interfaces/ISimulationService.js';
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

export class SimulationService implements ISimulationService {
  async create(_params: CreateSimulationParams): Promise<Simulation> {
    throw ApiError.notImplemented();
  }

  async heartbeat(_simulationId: string): Promise<void> {
    throw ApiError.notImplemented();
  }

  async commit(_simulationId: string): Promise<void> {
    throw ApiError.notImplemented();
  }

  async listClasses(_params: ListClassesParams): Promise<ListClassesResult> {
    throw ApiError.notImplemented();
  }

  async updateClass(
    _simulationId: string,
    _classId: string,
    _patch: UpdateClassParams,
  ): Promise<ScheduleClass> {
    throw ApiError.notImplemented();
  }

  async getSuggestions(_simulationId: string, _classId: string): Promise<readonly Suggestion[]> {
    throw ApiError.notImplemented();
  }

  async getConflicts(_simulationId: string): Promise<readonly Conflict[]> {
    throw ApiError.notImplemented();
  }

  async getMetrics(_simulationId: string): Promise<readonly MetricResult[]> {
    throw ApiError.notImplemented();
  }
}
