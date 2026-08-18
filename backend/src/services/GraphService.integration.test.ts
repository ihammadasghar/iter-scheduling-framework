// Real, non-mocked integration tests against a live Memgraph instance.
//
// Everything else in this repo mocks IMemgraphClient/neo4j-driver
// completely — this is the only file that actually executes Cypher against
// a real graph engine. It exists to close two gaps that mocked tests
// structurally cannot: (1) the ROOM_CAPACITY_EXCEEDED predicate
// (`g.size > r.capacity`) was previously proven only by a copy-pasted test
// asserting nothing; (2) `Professor:avg_gap_length`'s averaging arithmetic
// lives entirely inside the Cypher string (GraphService.evaluateMetrics does
// no JS-side aggregation), so only real execution can prove it correct.
//
// Run locally: `docker-compose up -d memgraph && cd backend && pnpm run
// test:integration` (see docs/testing.md). Wired into CI as a separate step
// from the (still fully manual) perf benchmark — these are fast,
// deterministic correctness assertions, not timing measurements.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import neo4j from 'neo4j-driver';
import type { Driver } from 'neo4j-driver';
import { MemgraphClient } from '../clients/MemgraphClient.js';
import { GraphService } from './GraphService.js';
import { ensureIndexes } from '../utils/schemaSetup.js';
import type { ScheduleJson } from '../types/scheduleJson.js';
import type { MetricRule } from '../types/domain.js';

const uri = process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687';

let driver: Driver;
let graph: GraphService;
let currentBranchId: string | undefined;

beforeAll(async () => {
  driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env['MEMGRAPH_USERNAME'] ?? '', process.env['MEMGRAPH_PASSWORD'] ?? ''),
  );
  const client = new MemgraphClient(driver);
  graph = new GraphService(client);
  await ensureIndexes(client);
}, 30_000);

afterEach(async () => {
  if (currentBranchId) {
    await graph.flush(currentBranchId);
    currentBranchId = undefined;
  }
});

afterAll(async () => {
  await driver.close();
});

function nextBranchId(): string {
  currentBranchId = `integration-test-${randomUUID()}`;
  return currentBranchId;
}

function baseSchedule(overrides: Partial<ScheduleJson>): ScheduleJson {
  return {
    metadata: {},
    timeSlots: [],
    rooms: [],
    professors: [],
    studentGroups: [],
    courses: [],
    classes: [],
    ...overrides,
  };
}

describe('GraphService (integration, real Memgraph)', () => {
  it('reports ROOM_CAPACITY_EXCEEDED when the group is larger than the room', async () => {
    const branchId = nextBranchId();
    const schedule = baseSchedule({
      timeSlots: [{ id: 'TS1', day: 'Monday', name: 'P1', startTime: '09:00', endTime: '10:00' }],
      rooms: [{ id: 'RM1', name: 'Room 1', capacity: 30, building: 'A' }],
      professors: [{ id: 'PR1', name: 'Prof A', department: 'CS' }],
      studentGroups: [{ id: 'SG1', name: 'Group A', size: 40 }],
      courses: [{ id: 'CR1', code: 'CS101', name: 'Intro', department: 'CS' }],
      classes: [{
        id: 'CL1', courseId: 'CR1', title: 'Intro', professorId: 'PR1',
        studentGroupId: 'SG1', roomId: 'RM1', timeSlotIds: ['TS1'],
      }],
    });

    await graph.hydrate(branchId, JSON.stringify(schedule));
    const conflicts = await graph.queryConflicts(branchId);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe('ROOM_CAPACITY_EXCEEDED');
  });

  // The gap this closes: the equivalent mocked test asserted the same thing
  // over an entirely empty, never-executed Cypher WHERE clause — a
  // tautology about Array.prototype.map over []. This constructs a real
  // fixture where the predicate is genuinely false and proves it via a real
  // query.
  it('does not report a capacity conflict when the group fits within the room', async () => {
    const branchId = nextBranchId();
    const schedule = baseSchedule({
      timeSlots: [{ id: 'TS1', day: 'Monday', name: 'P1', startTime: '09:00', endTime: '10:00' }],
      rooms: [{ id: 'RM1', name: 'Room 1', capacity: 30, building: 'A' }],
      professors: [{ id: 'PR1', name: 'Prof A', department: 'CS' }],
      studentGroups: [{ id: 'SG1', name: 'Group A', size: 25 }],
      courses: [{ id: 'CR1', code: 'CS101', name: 'Intro', department: 'CS' }],
      classes: [{
        id: 'CL1', courseId: 'CR1', title: 'Intro', professorId: 'PR1',
        studentGroupId: 'SG1', roomId: 'RM1', timeSlotIds: ['TS1'],
      }],
    });

    await graph.hydrate(branchId, JSON.stringify(schedule));
    const conflicts = await graph.queryConflicts(branchId);

    expect(conflicts).toEqual([]);
  });

  // Proves the averaging arithmetic for real: three same-day, consecutive
  // slots (:NEXT chain TS1 -> TS2 -> TS3); the professor teaches TS1 and
  // TS3, so the nearest-subsequent-class hop count is 2, meaning exactly 1
  // idle slot (TS2) between them. evaluateMetrics() does zero JS-side
  // aggregation of its own, so this is the only way to prove `hops - 1`,
  // averaged per professor then across professors, actually computes 1 here.
  it('computes the real idle-slot count for Professor:avg_gap_length', async () => {
    const branchId = nextBranchId();
    const schedule = baseSchedule({
      timeSlots: [
        { id: 'TS1', day: 'Monday', name: 'P1', startTime: '09:00', endTime: '10:00' },
        { id: 'TS2', day: 'Monday', name: 'P2', startTime: '10:00', endTime: '11:00' },
        { id: 'TS3', day: 'Monday', name: 'P3', startTime: '11:00', endTime: '12:00' },
      ],
      rooms: [{ id: 'RM1', name: 'Room 1', capacity: 100, building: 'A' }],
      professors: [{ id: 'PR1', name: 'Prof A', department: 'CS' }],
      studentGroups: [{ id: 'SG1', name: 'Group A', size: 10 }],
      courses: [{ id: 'CR1', code: 'CS101', name: 'Intro', department: 'CS' }],
      classes: [
        {
          id: 'CL1', courseId: 'CR1', title: 'Intro', professorId: 'PR1',
          studentGroupId: 'SG1', roomId: 'RM1', timeSlotIds: ['TS1'],
        },
        {
          id: 'CL2', courseId: 'CR1', title: 'Intro', professorId: 'PR1',
          studentGroupId: 'SG1', roomId: 'RM1', timeSlotIds: ['TS3'],
        },
      ],
    });
    const rule: MetricRule = {
      id: 'mr-gap', name: 'Avg Gap', target: 'Professor', condition: 'avg_gap_length', threshold: 0, weight: 1,
    };

    await graph.hydrate(branchId, JSON.stringify(schedule));
    const [result] = await graph.evaluateMetrics(branchId, [rule]);

    expect(result?.value).toBe(1);
  });

  // §2's Cypher simplification removed the (dead) CASE WHEN guards from
  // these two queries on the assumption that GraphService.evaluateMetrics'
  // JS-level fallback is what actually produces 0 for an empty branch. This
  // proves that assumption holds against a real, empty graph — not just in
  // the mocked unit tests, which can only assert on hand-constructed rows.
  it('defaults room_consistency to 0 on a branch with no professors', async () => {
    const branchId = nextBranchId();
    const rule: MetricRule = {
      id: 'mr-rc', name: 'Room Consistency', target: 'Professor', condition: 'room_consistency', threshold: 0, weight: 1,
    };

    await graph.hydrate(branchId, JSON.stringify(baseSchedule({})));
    const [result] = await graph.evaluateMetrics(branchId, [rule]);

    expect(result?.value).toBe(0);
  });

  it('defaults free_day_ratio to 0 on a branch with no student groups', async () => {
    const branchId = nextBranchId();
    const rule: MetricRule = {
      id: 'mr-fd', name: 'Free Day Ratio', target: 'StudentGroup', condition: 'free_day_ratio', threshold: 0, weight: 1,
    };

    await graph.hydrate(branchId, JSON.stringify(baseSchedule({})));
    const [result] = await graph.evaluateMetrics(branchId, [rule]);

    expect(result?.value).toBe(0);
  });
});
