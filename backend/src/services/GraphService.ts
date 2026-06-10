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
    simulationId: string,
    page: number,
    limit: number,
  ): Promise<readonly ScheduleClass[]> {
    const skip = Math.max(0, (page - 1) * limit);

    const cypher = `
      MATCH (c:Class {branchId: $branchId})
      WITH c
      ORDER BY c.id
      SKIP $skip
      LIMIT $limit
      OPTIONAL MATCH (c)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})
      OPTIONAL MATCH (c)-[:BELONGS_TO]->(cr:Course {branchId: $branchId})
      OPTIONAL MATCH (c)-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
      OPTIONAL MATCH (c)-[:ATTENDED_BY]->(g:StudentGroup {branchId: $branchId})
      OPTIONAL MATCH (c)-[:HELD_IN]->(r:Room {branchId: $branchId})
      WITH c, cr, p, g, r, collect(DISTINCT t.id) AS timeSlotIds
      RETURN {
        id: c.id,
        courseId: coalesce(c.courseId, cr.id),
        title: c.title,
        professorId: coalesce(c.professorId, p.id),
        studentGroupId: coalesce(c.studentGroupId, g.id),
        roomId: coalesce(c.roomId, r.id),
        timeSlotIds: timeSlotIds
      } AS class
      ORDER BY class.id
    `.trim();

    const params = { branchId: simulationId, skip, limit };

    const rows = await this.client.run<{ class: Record<string, unknown> }>(cypher, params);

    return rows.map((r) => {
      const c = r['class'] as Record<string, unknown>;
      return {
        id: String(c['id'] ?? ''),
        courseId: String(c['courseId'] ?? ''),
        title: String(c['title'] ?? ''),
        professorId: String(c['professorId'] ?? ''),
        studentGroupId: String(c['studentGroupId'] ?? ''),
        roomId: String(c['roomId'] ?? ''),
        timeSlotIds: Array.isArray(c['timeSlotIds']) ? (c['timeSlotIds'] as string[]) : [],
      } as ScheduleClass;
    });
  }

  async countClasses(simulationId: string): Promise<number> {
    const cypher = `MATCH (c:Class {branchId: $branchId}) RETURN count(c) AS total`.trim();
    const params = { branchId: simulationId };
    const rows = await this.client.run<{ total: number }>(cypher, params);
    const first = rows[0] as unknown as { total?: number } | undefined;
    return first?.total ? Number(first.total) : 0;
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

