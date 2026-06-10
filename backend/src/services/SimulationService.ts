import { randomUUID } from 'crypto';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ISimulationService } from '../interfaces/ISimulationService.js';
import type { ISessionRegistry } from '../sessions/ISessionRegistry.js';
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

const SOURCE_BRANCH = 'main';
const SCHEDULE_JSON_PATH = 'schedule.json';

export class SimulationService implements ISimulationService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly registry: ISessionRegistry,
  ) {}

  async create(params: CreateSimulationParams): Promise<Simulation> {
    const { userId } = params;
    if (!userId || userId.trim() === '') {
      throw ApiError.badRequest('userId is required');
    }

    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const simulationId = `sim-${sanitizedUserId}-${randomUUID().slice(0, 8)}`;
    const createdAt = new Date().toISOString();

    await this.github.createBranch(simulationId, SOURCE_BRANCH);

    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);

    try {
      await this.graph.hydrate(simulationId, scheduleJson);
    } catch (err) {
      await this.github.deleteBranch(simulationId);
      throw err;
    }

    this.registry.register(simulationId);

    return { id: simulationId, branchId: simulationId, createdAt };
  }

  async heartbeat(simulationId: string): Promise<void> {
    const found = this.registry.touch(simulationId);
    if (!found) {
      throw ApiError.notFound('Simulation not found or expired');
    }
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
