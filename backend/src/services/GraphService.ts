import { ApiError } from '../types/ApiError.js';
import { parseScheduleJson, buildHydrationBatches } from '../utils/ScheduleHydrator.js';
import { translateRule } from '../utils/MetricRuleTranslator.js';
import type { IMemgraphClient } from '../clients/IMemgraphClient.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ScheduleClass, Conflict, MetricResult, MetricRule } from '../types/domain.js';
import type {
  ScheduleJson,
  RawCourse,
  RawProfessor,
  RawStudentGroup,
  RawRoom,
  RawTimeSlot,
  RawClass,
} from '../types/scheduleJson.js';

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

  async exportScheduleJson(simulationId: string): Promise<string> {
    const branchId = simulationId;

    const [courses, professors, studentGroups, rooms, timeSlots, classes] = await Promise.all([
      this.client.run<{ course: Record<string, unknown> }>(
        `MATCH (n:Course {branchId: $branchId})
         RETURN { id: n.id, code: n.code, name: n.name, department: n.department } AS course
         ORDER BY n.id`.trim(),
        { branchId },
      ),
      this.client.run<{ professor: Record<string, unknown> }>(
        `MATCH (n:Professor {branchId: $branchId})
         RETURN { id: n.id, name: n.name, department: n.department } AS professor
         ORDER BY n.id`.trim(),
        { branchId },
      ),
      this.client.run<{ studentGroup: Record<string, unknown> }>(
        `MATCH (n:StudentGroup {branchId: $branchId})
         RETURN { id: n.id, name: n.name, size: n.size } AS studentGroup
         ORDER BY n.id`.trim(),
        { branchId },
      ),
      this.client.run<{ room: Record<string, unknown> }>(
        `MATCH (n:Room {branchId: $branchId})
         RETURN { id: n.id, name: n.name, capacity: n.capacity, building: n.building } AS room
         ORDER BY n.id`.trim(),
        { branchId },
      ),
      this.client.run<{ timeSlot: Record<string, unknown> }>(
        `MATCH (n:TimeSlot {branchId: $branchId})
         RETURN { id: n.id, day: n.day, name: n.name, startTime: n.startTime, endTime: n.endTime } AS timeSlot
         ORDER BY n.id`.trim(),
        { branchId },
      ),
      this.client.run<{ class: Record<string, unknown> }>(
        `MATCH (c:Class {branchId: $branchId})
         OPTIONAL MATCH (c)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})
         WITH c, collect(DISTINCT t.id) AS timeSlotIds
         ORDER BY c.id
         RETURN { id: c.id, courseId: c.courseId, title: c.title,
                  professorId: c.professorId, studentGroupId: c.studentGroupId,
                  roomId: c.roomId, timeSlotIds: timeSlotIds } AS class`.trim(),
        { branchId },
      ),
    ]);

    const schedule: ScheduleJson = {
      metadata: {},
      courses: courses.map((r) => r['course'] as unknown as RawCourse),
      professors: professors.map((r) => r['professor'] as unknown as RawProfessor),
      studentGroups: studentGroups.map((r) => r['studentGroup'] as unknown as RawStudentGroup),
      rooms: rooms.map((r) => r['room'] as unknown as RawRoom),
      timeSlots: timeSlots.map((r) => r['timeSlot'] as unknown as RawTimeSlot),
      classes: classes.map((r) => r['class'] as unknown as RawClass),
    };

    return JSON.stringify(schedule, null, 2);
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

  async queryConflicts(simulationId: string): Promise<readonly Conflict[]> {
    const branchId = simulationId;

    const [roomRows, professorRows, groupRows] = await Promise.all([
      this.client.run<ConflictRow>(
        `MATCH (c1:Class {branchId: $branchId})-[:HELD_IN]->(r:Room {branchId: $branchId})<-[:HELD_IN]-(c2:Class {branchId: $branchId})
         MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
         WHERE c1.id < c2.id
         RETURN c1.id AS classId1, c2.id AS classId2, r.name AS resourceName`.trim(),
        { branchId },
      ),
      this.client.run<ConflictRow>(
        `MATCH (c1:Class {branchId: $branchId})-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})<-[:TAUGHT_BY]-(c2:Class {branchId: $branchId})
         MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
         WHERE c1.id < c2.id
         RETURN c1.id AS classId1, c2.id AS classId2, p.name AS resourceName`.trim(),
        { branchId },
      ),
      this.client.run<ConflictRow>(
        `MATCH (c1:Class {branchId: $branchId})-[:ATTENDED_BY]->(g:StudentGroup {branchId: $branchId})<-[:ATTENDED_BY]-(c2:Class {branchId: $branchId})
         MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
         WHERE c1.id < c2.id
         RETURN c1.id AS classId1, c2.id AS classId2, g.name AS resourceName`.trim(),
        { branchId },
      ),
    ]);

    return [
      ...roomRows.map((r) => toConflict(r, 'ROOM_DOUBLE_BOOK')),
      ...professorRows.map((r) => toConflict(r, 'PROFESSOR_OVERLAP')),
      ...groupRows.map((r) => toConflict(r, 'GROUP_OVERLAP')),
    ];
  }

  async evaluateMetrics(simulationId: string, rules: readonly MetricRule[]): Promise<readonly MetricResult[]> {
    const branchId = simulationId;
    const results: MetricResult[] = [];

    for (const rule of rules) {
      const { cypher, unit } = translateRule(rule);
      const rows = await this.client.run<{ value: unknown }>(cypher, { branchId });
      const raw = rows[0]?.['value'];
      const value = raw !== undefined && raw !== null ? Number(raw) : 0;
      results.push({ name: rule.name, value, unit });
    }

    return results;
  }
}

// ── Conflict helpers ─────────────────────────────────────────────────────────

interface ConflictRow {
  readonly classId1: string;
  readonly classId2: string;
  readonly resourceName: string;
}

const toConflict = (row: ConflictRow, type: Conflict['type']): Conflict => ({
  id: `${type}_${row.classId1}_${row.classId2}`,
  type,
  classIds: [row.classId1, row.classId2],
  message: buildConflictMessage(type, row.classId1, row.classId2, row.resourceName),
});

const buildConflictMessage = (
  type: Conflict['type'],
  classId1: string,
  classId2: string,
  resourceName: string,
): string => {
  if (type === 'ROOM_DOUBLE_BOOK') {
    return `Classes ${classId1} and ${classId2} both occupy room '${resourceName}' at the same time`;
  }
  if (type === 'PROFESSOR_OVERLAP') {
    return `Professor '${resourceName}' is double-booked for classes ${classId1} and ${classId2}`;
  }
  return `Student group '${resourceName}' is scheduled in two classes simultaneously: ${classId1} and ${classId2}`;
};
