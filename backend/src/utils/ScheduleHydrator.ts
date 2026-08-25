import { ApiError } from '../types/ApiError.js';
import type {
  ScheduleJson,
  RawTimeSlot,
  RawClass,
} from '../types/scheduleJson.js';

export interface CypherBatch {
  readonly cypher: string;
  readonly params: Record<string, unknown>;
}

// Day ordering for building the chronological NEXT chain between TimeSlots.
const DAY_ORDER: readonly string[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export function parseScheduleJson(raw: string): ScheduleJson {
  try {
    return JSON.parse(raw) as ScheduleJson;
  } catch {
    throw ApiError.badRequest('schedule.json contains invalid JSON');
  }
}

// Renders an object as compact single-line JSON with the spacing style the
// schedule.json fixtures use: `{ "key": value, "key2": value2 }`.
function stringifyCompactObject(obj: object): string {
  const entries = Object.entries(obj).map(
    ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
  );
  return `{ ${entries.join(', ')} }`;
}

function indent(text: string, prefix: string): string {
  return text.split('\n').join(`\n${prefix}`);
}

function renderArray<T extends object>(items: readonly T[]): string {
  if (items.length === 0) return '[]';
  const lines = items.map((item) => `    ${stringifyCompactObject(item)}`).join(',\n');
  return `[\n${lines}\n  ]`;
}

// Serializes a ScheduleJson exactly the way the seed fixtures (e.g.
// fixtures/mock-schedule.json) are formatted: pretty-printed at the top
// level, but every array element compact on its own line. This isn't just
// cosmetic — LocalGitHubService.getPullRequestDiff produces a plain textual
// diff of this file between branches, and the frontend's diffParser.ts only
// recognizes a changed class when a diff line is a single, complete JSON
// object. Any mismatch here (e.g. plain `JSON.stringify(schedule, null, 2)`,
// which spreads every field onto its own line) silently drops every
// field-level change — not just room changes — from the admin's "Changes in
// this Proposal" view, because a bare `"roomId": "RM_102",` diff line can't
// be parsed as a complete class object.
export function stringifyScheduleJson(schedule: ScheduleJson): string {
  const parts = [
    `  "metadata": ${indent(JSON.stringify(schedule.metadata, null, 2), '  ')}`,
    `  "timeSlots": ${renderArray(schedule.timeSlots)}`,
    `  "rooms": ${renderArray(schedule.rooms)}`,
    `  "professors": ${renderArray(schedule.professors)}`,
    `  "studentGroups": ${renderArray(schedule.studentGroups)}`,
    `  "courses": ${renderArray(schedule.courses)}`,
    `  "classes": ${renderArray(schedule.classes)}`,
  ];
  return `{\n${parts.join(',\n')}\n}\n`;
}

export function buildHydrationBatches(
  json: ScheduleJson,
  branchId: string,
): readonly CypherBatch[] {
  return [
    buildCourseBatch(json, branchId),
    buildProfessorBatch(json, branchId),
    buildStudentGroupBatch(json, branchId),
    buildRoomBatch(json, branchId),
    buildTimeSlotBatch(json, branchId),
    buildClassBatch(json, branchId),
    buildBelongsToEdges(json, branchId),
    buildTaughtByEdges(json, branchId),
    buildAttendedByEdges(json, branchId),
    buildHeldInEdges(json, branchId),
    buildScheduledAtEdges(json, branchId),
    buildNextEdges(json, branchId),
  ];
}

// ── Node batches ─────────────────────────────────────────────────────────────

function buildCourseBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (c:Course {id: n.id, branchId: $branchId})
      SET c += {code: n.code, name: n.name, department: n.department}
    `.trim(),
    params: {
      branchId,
      nodes: json.courses.map((c) => ({ id: c.id, code: c.code, name: c.name, department: c.department })),
    },
  };
}

function buildProfessorBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (p:Professor {id: n.id, branchId: $branchId})
      SET p += {name: n.name, department: n.department}
    `.trim(),
    params: {
      branchId,
      nodes: json.professors.map((p) => ({ id: p.id, name: p.name, department: p.department })),
    },
  };
}

function buildStudentGroupBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (g:StudentGroup {id: n.id, branchId: $branchId})
      SET g += {name: n.name, size: n.size}
    `.trim(),
    params: {
      branchId,
      nodes: json.studentGroups.map((g) => ({ id: g.id, name: g.name, size: g.size })),
    },
  };
}

function buildRoomBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (r:Room {id: n.id, branchId: $branchId})
      SET r += {name: n.name, capacity: n.capacity, building: n.building}
    `.trim(),
    params: {
      branchId,
      nodes: json.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, building: r.building })),
    },
  };
}

function buildTimeSlotBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (t:TimeSlot {id: n.id, branchId: $branchId})
      SET t += {day: n.day, name: n.name, startTime: n.startTime, endTime: n.endTime}
    `.trim(),
    params: {
      branchId,
      nodes: json.timeSlots.map((t) => ({
        id: t.id, day: t.day, name: t.name, startTime: t.startTime, endTime: t.endTime,
      })),
    },
  };
}

function buildClassBatch(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $nodes AS n
      MERGE (c:Class {id: n.id, branchId: $branchId})
      SET c += {title: n.title, courseId: n.courseId, professorId: n.professorId,
                studentGroupId: n.studentGroupId, roomId: n.roomId}
    `.trim(),
    params: {
      branchId,
      nodes: json.classes.map((c) => ({
        id: c.id, title: c.title, courseId: c.courseId,
        professorId: c.professorId, studentGroupId: c.studentGroupId, roomId: c.roomId,
      })),
    },
  };
}

// ── Edge batches ─────────────────────────────────────────────────────────────

function buildBelongsToEdges(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (c:Class {id: e.classId, branchId: $branchId})
      MATCH (cr:Course {id: e.courseId, branchId: $branchId})
      MERGE (c)-[:BELONGS_TO]->(cr)
    `.trim(),
    params: {
      branchId,
      edges: json.classes.map((c) => ({ classId: c.id, courseId: c.courseId })),
    },
  };
}

function buildTaughtByEdges(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (c:Class {id: e.classId, branchId: $branchId})
      MATCH (p:Professor {id: e.professorId, branchId: $branchId})
      MERGE (c)-[:TAUGHT_BY]->(p)
    `.trim(),
    params: {
      branchId,
      edges: json.classes.map((c) => ({ classId: c.id, professorId: c.professorId })),
    },
  };
}

function buildAttendedByEdges(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (c:Class {id: e.classId, branchId: $branchId})
      MATCH (g:StudentGroup {id: e.studentGroupId, branchId: $branchId})
      MERGE (c)-[:ATTENDED_BY]->(g)
    `.trim(),
    params: {
      branchId,
      edges: json.classes.map((c) => ({ classId: c.id, studentGroupId: c.studentGroupId })),
    },
  };
}

function buildHeldInEdges(json: ScheduleJson, branchId: string): CypherBatch {
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (c:Class {id: e.classId, branchId: $branchId})
      MATCH (r:Room {id: e.roomId, branchId: $branchId})
      MERGE (c)-[:HELD_IN]->(r)
    `.trim(),
    params: {
      branchId,
      edges: json.classes.map((c) => ({ classId: c.id, roomId: c.roomId })),
    },
  };
}

function buildScheduledAtEdges(json: ScheduleJson, branchId: string): CypherBatch {
  const edges = json.classes.flatMap((c) =>
    c.timeSlotIds.map((slotId) => ({ classId: c.id, timeSlotId: slotId })),
  );
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (c:Class {id: e.classId, branchId: $branchId})
      MATCH (t:TimeSlot {id: e.timeSlotId, branchId: $branchId})
      MERGE (c)-[:SCHEDULED_AT]->(t)
    `.trim(),
    params: { branchId, edges },
  };
}

function buildNextEdges(json: ScheduleJson, branchId: string): CypherBatch {
  const edges = buildChronologicalPairs(json.timeSlots);
  return {
    cypher: `
      UNWIND $edges AS e
      MATCH (a:TimeSlot {id: e.fromId, branchId: $branchId})
      MATCH (b:TimeSlot {id: e.toId, branchId: $branchId})
      MERGE (a)-[:NEXT]->(b)
    `.trim(),
    params: { branchId, edges },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface NextEdge {
  readonly fromId: string;
  readonly toId: string;
}

function buildChronologicalPairs(slots: readonly RawTimeSlot[]): readonly NextEdge[] {
  // Group slots by day
  const byDay = slots.reduce<Map<string, RawTimeSlot[]>>((acc, slot) => {
    const existing = acc.get(slot.day) ?? [];
    acc.set(slot.day, [...existing, slot]);
    return acc;
  }, new Map());

  // For each day, sort slots by startTime and produce consecutive pairs
  return [...byDay.entries()]
    .sort(([dayA], [dayB]) => DAY_ORDER.indexOf(dayA) - DAY_ORDER.indexOf(dayB))
    .flatMap(([, daySlots]) => {
      const sorted = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return sorted
        .slice(0, -1)
        .map((slot, i) => ({ fromId: slot.id, toId: sorted[i + 1]!.id }));
    });
}

// ── Type predicate used by RawClass edge builders ─────────────────────────────

function toClassEdge<T>(mapper: (c: RawClass) => T): (c: RawClass) => T {
  return mapper;
}

// Suppress unused warning — kept for future use in edge builder pattern
void toClassEdge;
