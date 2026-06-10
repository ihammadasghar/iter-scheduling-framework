import { ApiError } from '../types/ApiError.js';
import { parseScheduleJson, buildHydrationBatches } from '../utils/ScheduleHydrator.js';
import type { IMemgraphClient } from '../clients/IMemgraphClient.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ScheduleClass, Conflict, MetricResult } from '../types/domain.js';

export class GraphService implements IGraphService {
  constructor(private readonly client: IMemgraphClient) {}

  async hydrate(branchId: string, scheduleJson: string): Promise<void> {
    const json = parseScheduleJson(scheduleJson);
    const batches = buildHydrationBatches(json, branchId);
    for (const batch of batches) {
      await this.client.run(batch.cypher, batch.params);
    }
  }

  async flush(branchId: string): Promise<void> {
    await this.client.run(
      'MATCH (n {branchId: $branchId}) DETACH DELETE n',
      { branchId },
    );
  }

  async exportScheduleJson(_simulationId: string): Promise<string> {
    throw ApiError.notImplemented();
  }

  async listClasses(
    _simulationId: string,
    _page: number,
    _limit: number,
  ): Promise<readonly ScheduleClass[]> {
    throw ApiError.notImplemented();
  }

  async countClasses(_simulationId: string): Promise<number> {
    throw ApiError.notImplemented();
  }

  async updateClass(
    _simulationId: string,
    _classId: string,
    _patch: Partial<ScheduleClass>,
  ): Promise<ScheduleClass> {
    throw ApiError.notImplemented();
  }

  async getSuggestions(_simulationId: string, _classId: string): Promise<readonly string[]> {
    throw ApiError.notImplemented();
  }

  async queryConflicts(_simulationId: string): Promise<readonly Conflict[]> {
    throw ApiError.notImplemented();
  }

  async evaluateMetrics(_simulationId: string): Promise<readonly MetricResult[]> {
    throw ApiError.notImplemented();
  }
}

