import { describe, it, expect } from 'vitest';
import { diffSchedules, diffConflictsById } from './ScheduleDiffer.js';
import type { RawClass, ScheduleJson } from '../types/scheduleJson.js';
import type { Conflict } from '../types/domain.js';

const ROSTER = {
  metadata: {},
  courses: [{ id: 'CRS_001', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' }],
  professors: [{ id: 'PRF_001', name: 'Dr. Smith', department: 'Biology' }],
  studentGroups: [{ id: 'GRP_001', name: 'Bio Year 1', size: 40 }],
  rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 50, building: 'Science Hall' }],
  timeSlots: [
    { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
    { id: 'TS_MON_P2', day: 'Monday', name: 'Period 2', startTime: '10:30', endTime: '12:15' },
  ],
};

function makeClass(overrides: Partial<RawClass> = {}): RawClass {
  return {
    id: 'CLS_001',
    courseId: 'CRS_001',
    title: 'Intro to Biology Lecture',
    professorId: 'PRF_001',
    studentGroupId: 'GRP_001',
    roomId: 'RM_101',
    timeSlotIds: ['TS_MON_P1'],
    ...overrides,
  };
}

function makeSchedule(classes: readonly RawClass[]): ScheduleJson {
  return { ...ROSTER, classes };
}

describe('diffSchedules', () => {
  it('returns empty diff for identical schedules', () => {
    const schedule = makeSchedule([makeClass()]);
    const result = diffSchedules(schedule, schedule);
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it('reports a class only present in candidate as added', () => {
    const main = makeSchedule([]);
    const candidate = makeSchedule([makeClass()]);
    const result = diffSchedules(main, candidate);
    expect(result.added).toEqual([makeClass()]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it('reports a class only present in main as removed', () => {
    const main = makeSchedule([makeClass()]);
    const candidate = makeSchedule([]);
    const result = diffSchedules(main, candidate);
    expect(result.removed).toEqual([makeClass()]);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it('detects a changed roomId (previously the only kind diffParser surfaced)', () => {
    const main = makeSchedule([makeClass({ roomId: 'RM_101' })]);
    const candidate = makeSchedule([makeClass({ roomId: 'RM_102' })]);
    const result = diffSchedules(main, candidate);
    expect(result.changed).toEqual([
      {
        classId: 'CLS_001',
        before: makeClass({ roomId: 'RM_101' }),
        after: makeClass({ roomId: 'RM_102' }),
        fieldChanges: [{ field: 'roomId', before: 'RM_101', after: 'RM_102' }],
      },
    ]);
  });

  it('detects non-whitelisted field changes (title, courseId, studentGroupId) that diffParser used to miss', () => {
    const main = makeSchedule([makeClass()]);
    const candidate = makeSchedule([
      makeClass({ title: 'Advanced Biology', courseId: 'CRS_002', studentGroupId: 'GRP_002' }),
    ]);
    const result = diffSchedules(main, candidate);
    expect(result.changed).toHaveLength(1);
    const fields = result.changed[0]!.fieldChanges.map((f) => f.field).sort();
    expect(fields).toEqual(['courseId', 'studentGroupId', 'title']);
  });

  it('detects multiple simultaneous field changes on one class', () => {
    const main = makeSchedule([makeClass({ roomId: 'RM_101', professorId: 'PRF_001' })]);
    const candidate = makeSchedule([makeClass({ roomId: 'RM_102', professorId: 'PRF_002' })]);
    const result = diffSchedules(main, candidate);
    const fields = result.changed[0]!.fieldChanges.map((f) => f.field).sort();
    expect(fields).toEqual(['professorId', 'roomId']);
  });

  it('treats timeSlotIds as order-independent', () => {
    const main = makeSchedule([makeClass({ timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'] })]);
    const candidate = makeSchedule([makeClass({ timeSlotIds: ['TS_MON_P2', 'TS_MON_P1'] })]);
    const result = diffSchedules(main, candidate);
    expect(result.changed).toEqual([]);
  });

  it('detects an actual timeSlotIds change', () => {
    const main = makeSchedule([makeClass({ timeSlotIds: ['TS_MON_P1'] })]);
    const candidate = makeSchedule([makeClass({ timeSlotIds: ['TS_MON_P2'] })]);
    const result = diffSchedules(main, candidate);
    expect(result.changed[0]!.fieldChanges).toEqual([
      { field: 'timeSlotIds', before: ['TS_MON_P1'], after: ['TS_MON_P2'] },
    ]);
  });

  it('excludes a class with no field changes even if object identity differs', () => {
    const main = makeSchedule([makeClass()]);
    const candidate = makeSchedule([makeClass()]);
    const result = diffSchedules(main, candidate);
    expect(result.changed).toEqual([]);
  });

  it('handles added, removed, and changed classes together', () => {
    const main = makeSchedule([
      makeClass({ id: 'CLS_001' }),
      makeClass({ id: 'CLS_002', roomId: 'RM_101' }),
    ]);
    const candidate = makeSchedule([
      makeClass({ id: 'CLS_002', roomId: 'RM_102' }),
      makeClass({ id: 'CLS_003' }),
    ]);
    const result = diffSchedules(main, candidate);
    expect(result.added.map((c) => c.id)).toEqual(['CLS_003']);
    expect(result.removed.map((c) => c.id)).toEqual(['CLS_001']);
    expect(result.changed.map((c) => c.classId)).toEqual(['CLS_002']);
  });
});

function makeConflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_004',
    type: 'ROOM_DOUBLE_BOOK',
    classIds: ['CLS_001', 'CLS_004'],
    message: 'CLS_001 and CLS_004 are both booked in RM_101 at the same time.',
    ...overrides,
  };
}

describe('diffConflictsById', () => {
  it('returns empty delta when both sides are empty', () => {
    expect(diffConflictsById([], [])).toEqual({ added: [], resolved: [] });
  });

  it('reports a conflict only in candidate as added', () => {
    const conflict = makeConflict();
    const result = diffConflictsById([], [conflict]);
    expect(result.added).toEqual([conflict]);
    expect(result.resolved).toEqual([]);
  });

  it('reports a conflict only in baseline as resolved', () => {
    const conflict = makeConflict();
    const result = diffConflictsById([conflict], []);
    expect(result.resolved).toEqual([conflict]);
    expect(result.added).toEqual([]);
  });

  it('excludes a conflict present on both sides (matched by id)', () => {
    const conflict = makeConflict();
    const result = diffConflictsById([conflict], [conflict]);
    expect(result).toEqual({ added: [], resolved: [] });
  });

  it('handles a mix of added and resolved conflicts', () => {
    const stillThere = makeConflict({ id: 'A' });
    const resolvedOne = makeConflict({ id: 'B' });
    const newOne = makeConflict({ id: 'C' });
    const result = diffConflictsById([stillThere, resolvedOne], [stillThere, newOne]);
    expect(result.added.map((c) => c.id)).toEqual(['C']);
    expect(result.resolved.map((c) => c.id)).toEqual(['B']);
  });
});
