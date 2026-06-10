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
    simulationId: string,
    classId: string,
    patch: Partial<ScheduleClass>,
  ): Promise<ScheduleClass> {
    if (patch.roomId !== undefined) {
      await this.client.run(
        `
        MATCH (c:Class {id: $classId, branchId: $branchId})
        OPTIONAL MATCH (c)-[rel:HELD_IN]->()
        DELETE rel
        WITH c
        MATCH (r:Room {id: $roomId, branchId: $branchId})
        MERGE (c)-[:HELD_IN]->(r)
        SET c.roomId = $roomId
        `.trim(),
        { branchId: simulationId, classId, roomId: patch.roomId },
      );
    }

    if (patch.timeSlotIds !== undefined) {
      await this.client.run(
        `
        MATCH (c:Class {id: $classId, branchId: $branchId})
        OPTIONAL MATCH (c)-[rel:SCHEDULED_AT]->()
        DELETE rel
        WITH c
        UNWIND $timeSlotIds AS slotId
        MATCH (t:TimeSlot {id: slotId, branchId: $branchId})
        MERGE (c)-[:SCHEDULED_AT]->(t)
        `.trim(),
        { branchId: simulationId, classId, timeSlotIds: [...patch.timeSlotIds] },
      );
    }

    if (patch.professorId !== undefined) {
      await this.client.run(
        `
        MATCH (c:Class {id: $classId, branchId: $branchId})
        OPTIONAL MATCH (c)-[rel:TAUGHT_BY]->()
        DELETE rel
        WITH c
        MATCH (p:Professor {id: $professorId, branchId: $branchId})
        MERGE (c)-[:TAUGHT_BY]->(p)
        SET c.professorId = $professorId
        `.trim(),
        { branchId: simulationId, classId, professorId: patch.professorId },
      );
    }

    return this.fetchClass(simulationId, classId);
  }

  private async fetchClass(simulationId: string, classId: string): Promise<ScheduleClass> {
    const cypher = `
      MATCH (c:Class {id: $classId, branchId: $branchId})
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
    `.trim();

    const rows = await this.client.run<{ class: Record<string, unknown> }>(cypher, {
      branchId: simulationId,
      classId,
    });

    const first = rows[0];
    if (!first) {
      throw ApiError.notFound(`Class '${classId}' not found in simulation '${simulationId}'`);
    }

    const c = first['class'] as Record<string, unknown>;
    return {
      id: String(c['id'] ?? ''),
      courseId: String(c['courseId'] ?? ''),
      title: String(c['title'] ?? ''),
      professorId: String(c['professorId'] ?? ''),
      studentGroupId: String(c['studentGroupId'] ?? ''),
      roomId: String(c['roomId'] ?? ''),
      timeSlotIds: Array.isArray(c['timeSlotIds']) ? (c['timeSlotIds'] as string[]) : [],
    };
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

