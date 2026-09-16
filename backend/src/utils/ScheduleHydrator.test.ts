import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { parseScheduleJson, buildHydrationBatches, stringifyScheduleJson } from './ScheduleHydrator.js';
import type { ScheduleJson } from '../types/scheduleJson.js';

const BRANCH_ID = 'sim-test-1';

const MINIMAL_SCHEDULE: ScheduleJson = {
  metadata: {},
  courses: [{ id: 'CRS_001', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' }],
  professors: [{ id: 'PRF_001', name: 'Dr. Smith', department: 'Biology' }],
  studentGroups: [{ id: 'GRP_001', name: 'Bio Year 1', size: 40 }],
  rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 50, building: 'Science Hall' }],
  timeSlots: [
    { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
    { id: 'TS_MON_P2', day: 'Monday', name: 'Period 2', startTime: '10:30', endTime: '12:15' },
    { id: 'TS_TUE_P1', day: 'Tuesday', name: 'Period 1', startTime: '09:00', endTime: '11:30' },
  ],
  classes: [
    {
      id: 'CLS_001',
      courseId: 'CRS_001',
      title: 'Intro to Biology Lecture',
      professorId: 'PRF_001',
      studentGroupId: 'GRP_001',
      roomId: 'RM_101',
      timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'],
    },
  ],
};

describe('ScheduleHydrator', () => {
  // ── parseScheduleJson ──────────────────────────────────────────────────────

  it('parseScheduleJson parses a valid JSON string into a ScheduleJson object', () => {
    const raw = JSON.stringify(MINIMAL_SCHEDULE);
    const result = parseScheduleJson(raw);
    expect(result.classes).toHaveLength(1);
    expect(result.timeSlots).toHaveLength(3);
  });

  it('parseScheduleJson throws a 400 ApiError on invalid JSON', () => {
    expect(() => parseScheduleJson('not-valid-json{')).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'BAD_REQUEST' }),
    );
  });

  // ── buildHydrationBatches ──────────────────────────────────────────────────

  it('buildHydrationBatches returns exactly 12 CypherBatch objects', () => {
    const batches = buildHydrationBatches(MINIMAL_SCHEDULE, BRANCH_ID);
    expect(batches).toHaveLength(12);
  });

  it('every node batch includes branchId in params', () => {
    const batches = buildHydrationBatches(MINIMAL_SCHEDULE, BRANCH_ID);
    // First 6 batches are node batches
    batches.slice(0, 6).forEach((batch) => {
      expect(batch.params['branchId']).toBe(BRANCH_ID);
    });
  });

  it('SCHEDULED_AT batch contains one edge per timeSlotId across all classes', () => {
    const batches = buildHydrationBatches(MINIMAL_SCHEDULE, BRANCH_ID);
    // SCHEDULED_AT is the 11th batch (index 10)
    const scheduledAt = batches[10];
    expect(scheduledAt).toBeDefined();
    const edges = scheduledAt!.params['edges'] as Array<{ classId: string; timeSlotId: string }>;
    // CLS_001 has 2 timeSlotIds → expect 2 edges
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.timeSlotId)).toEqual(
      expect.arrayContaining(['TS_MON_P1', 'TS_MON_P2']),
    );
  });

  it('NEXT batch links consecutive same-day slots in chronological order', () => {
    const batches = buildHydrationBatches(MINIMAL_SCHEDULE, BRANCH_ID);
    // NEXT is the 12th batch (index 11)
    const nextBatch = batches[11];
    expect(nextBatch).toBeDefined();
    const edges = nextBatch!.params['edges'] as Array<{ fromId: string; toId: string }>;
    // Monday has 2 slots (P1 → P2); Tuesday has 1 slot (no NEXT edge)
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({ fromId: 'TS_MON_P1', toId: 'TS_MON_P2' });
  });

  // ── stringifyScheduleJson ────────────────────────────────────────────────
  // This formatting is not cosmetic: LocalGitHubService.getPullRequestDiff
  // textually diffs schedule.json between branches, and the frontend's
  // diffParser.ts only recognizes a changed class when a diff line is a
  // single, complete JSON object. Regressing to one-field-per-line output
  // (e.g. plain `JSON.stringify(schedule, null, 2)`) silently drops every
  // field-level change from the admin's "Changes in this Proposal" view.

  it('stringifyScheduleJson renders each array element on its own compact line', () => {
    const output = stringifyScheduleJson(MINIMAL_SCHEDULE);
    const lines = output.split('\n');

    expect(lines).toContain(
      '    { "id": "CRS_001", "code": "BIO101", "name": "Intro to Biology", "department": "Biology" }',
    );
    expect(lines).toContain(
      '    { "id": "CLS_001", "courseId": "CRS_001", "title": "Intro to Biology Lecture", "professorId": "PRF_001", "studentGroupId": "GRP_001", "roomId": "RM_101", "timeSlotIds": ["TS_MON_P1","TS_MON_P2"] }',
    );
  });

  it('stringifyScheduleJson renders empty arrays as []', () => {
    const output = stringifyScheduleJson({ ...MINIMAL_SCHEDULE, classes: [] });
    expect(output).toContain('"classes": []');
  });

  it('stringifyScheduleJson output round-trips through parseScheduleJson unchanged', () => {
    const output = stringifyScheduleJson(MINIMAL_SCHEDULE);
    expect(parseScheduleJson(output)).toEqual(MINIMAL_SCHEDULE);
  });

  it('stringifyScheduleJson matches the seed fixture\'s exact per-class line format, so an unedited class produces zero diff lines against main', () => {
    const fixtureRaw = readFileSync(join(__dirname, '../fixtures/mock-schedule.json'), 'utf-8');
    const fixtureSchedule = parseScheduleJson(fixtureRaw);

    // GraphService always exports metadata as {} (reconstructing the full
    // roster metadata is a separate, already-flagged future task) — hold
    // that fixed so this test isolates the per-record array formatting.
    const output = stringifyScheduleJson({ ...fixtureSchedule, metadata: {} });
    const classLine = output.split('\n').find((line) => line.includes('CLS_000001'));

    expect(classLine).toBeDefined();
    expect(fixtureRaw).toContain(classLine!.trim());
  });
});
