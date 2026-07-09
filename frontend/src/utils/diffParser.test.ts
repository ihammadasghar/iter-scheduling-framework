import { describe, it, expect } from 'vitest';
import { parseDiff } from './diffParser';
import type { ScheduleJson } from '@/types/schedule';

const schedule: ScheduleJson = {
  metadata: { semesterId: 's1', semesterName: 'Semester 1', academicYear: '2024' },
  timeSlots: [
    { id: 'TS_MON_P1', day: 'Monday', name: 'P1', startTime: '09:00', endTime: '10:00' },
    { id: 'TS_MON_P2', day: 'Monday', name: 'P2', startTime: '10:00', endTime: '11:00' },
  ],
  rooms: [
    { id: 'RM_101', name: 'Room 101', capacity: 30, building: 'Block A' },
    { id: 'RM_201', name: 'Room 201', capacity: 50, building: 'Block B' },
  ],
  professors: [
    { id: 'PRF_SMITH', name: 'Dr Smith', department: 'Biology' },
    { id: 'PRF_JONES', name: 'Dr Jones', department: 'Biology' },
  ],
  studentGroups: [{ id: 'GRP_BIO_Y1', name: 'Bio Y1', size: 25 }],
  courses: [{ id: 'CRS_BIO101', code: 'BIO101', name: 'Biology 101', department: 'Biology' }],
  classes: [{ id: 'CLS_001', courseId: 'CRS_BIO101', title: 'Biology 101 Lecture', professorId: 'PRF_SMITH', studentGroupId: 'GRP_BIO_Y1', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'] }],
};

const buildDiff = (before: object, after: object): string => [
  '--- a/schedule.json',
  '+++ b/schedule.json',
  '@@ -1,5 +1,5 @@',
  ' {',
  '  "classes": [',
  `-  ${JSON.stringify(before)},`,
  `+  ${JSON.stringify(after)},`,
  '  ]',
  ' }',
].join('\n');

describe('parseDiff', () => {
  it('returns empty array for empty diff', () => {
    expect(parseDiff('', schedule)).toEqual([]);
  });

  it('returns empty array when nothing changed', () => {
    const cls = schedule.classes[0]!;
    expect(parseDiff(buildDiff(cls, cls), schedule)).toEqual([]);
  });

  it('detects a room change and resolves IDs to names', () => {
    const before = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'], title: 'Biology 101 Lecture' };
    const after  = { id: 'CLS_001', roomId: 'RM_201', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'], title: 'Biology 101 Lecture' };
    const result = parseDiff(buildDiff(before, after), schedule);
    expect(result).toHaveLength(1);
    expect(result[0]!.className).toBe('Biology 101 Lecture');
    expect(result[0]!.changes).toHaveLength(1);
    expect(result[0]!.changes[0]!.field).toBe('Room');
    expect(result[0]!.changes[0]!.from).toBe('Room 101 (Block A)');
    expect(result[0]!.changes[0]!.to).toBe('Room 201 (Block B)');
  });

  it('detects a professor change and resolves names', () => {
    const before = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'], title: 'Bio Lecture' };
    const after  = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_JONES', timeSlotIds: ['TS_MON_P1'], title: 'Bio Lecture' };
    const result = parseDiff(buildDiff(before, after), schedule);
    expect(result[0]!.changes[0]!.field).toBe('Lecturer');
    expect(result[0]!.changes[0]!.from).toBe('Dr Smith');
    expect(result[0]!.changes[0]!.to).toBe('Dr Jones');
  });

  it('detects a time slot change and resolves names', () => {
    const before = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'], title: 'Bio Lecture' };
    const after  = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P2'], title: 'Bio Lecture' };
    const result = parseDiff(buildDiff(before, after), schedule);
    expect(result[0]!.changes[0]!.field).toBe('Time');
    expect(result[0]!.changes[0]!.from).toBe('Monday P1');
    expect(result[0]!.changes[0]!.to).toBe('Monday P2');
  });

  it('can detect multiple field changes on the same class', () => {
    const before = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'], title: 'Bio Lecture' };
    const after  = { id: 'CLS_001', roomId: 'RM_201', professorId: 'PRF_JONES', timeSlotIds: ['TS_MON_P1'], title: 'Bio Lecture' };
    const result = parseDiff(buildDiff(before, after), schedule);
    expect(result[0]!.changes).toHaveLength(2);
  });

  it('ignores added-only entries (no matching removal)', () => {
    const diff = [
      '--- a/schedule.json',
      '+++ b/schedule.json',
      ' "classes": [',
      '+  {"id":"CLS_NEW","roomId":"RM_101","professorId":"PRF_SMITH","timeSlotIds":[]},',
      ' ]',
    ].join('\n');
    expect(parseDiff(diff, schedule)).toEqual([]);
  });

  it('is a pure function — does not mutate the schedule argument', () => {
    const frozen = JSON.parse(JSON.stringify(schedule)) as ScheduleJson;
    const before = { id: 'CLS_001', roomId: 'RM_101', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'] };
    const after  = { id: 'CLS_001', roomId: 'RM_201', professorId: 'PRF_SMITH', timeSlotIds: ['TS_MON_P1'] };
    parseDiff(buildDiff(before, after), frozen);
    expect(frozen.rooms[0]!.id).toBe('RM_101'); // unchanged
  });
});
