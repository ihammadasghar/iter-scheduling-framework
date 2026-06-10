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

  async listClasses(params: ListClassesParams): Promise<ListClassesResult> {
    const { simulationId, page, limit } = params;

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const MAX_LIMIT = 500;
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);

    // Ensure simulation exists in registry (session must be active/hydrated).
    // Calling touch refreshes the heartbeat and returns false if not registered.
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const total = await this.graph.countClasses(simulationId);
    const data = await this.graph.listClasses(simulationId, safePage, safeLimit);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async updateClass(
    simulationId: string,
    classId: string,
    patch: UpdateClassParams,
  ): Promise<ScheduleClass> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    if (patch.roomId === undefined && patch.timeSlotIds === undefined && patch.professorId === undefined) {
      throw ApiError.badRequest('Patch must include at least one field: roomId, timeSlotIds, or professorId');
    }

    return this.graph.updateClass(simulationId, classId, patch);
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
