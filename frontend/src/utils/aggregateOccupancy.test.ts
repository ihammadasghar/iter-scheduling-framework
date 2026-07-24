import { describe, it, expect } from 'vitest';
import { aggregateOccupancy } from './aggregateOccupancy';
import type { ScheduleClass, RawRoom, RawStudentGroup } from '@/types';

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 };

const makeClass = (overrides: Partial<ScheduleClass> = {}): ScheduleClass => ({
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
  ...overrides,
});

describe('aggregateOccupancy', () => {
  it('returns an empty map when there are no classes', () => {
    const result = aggregateOccupancy([], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });

  it('computes seat-fill ratio as studentGroup.size / room.capacity', () => {
    const result = aggregateOccupancy([makeClass()], [ROOM], [GROUP]);
    const cell = result.get('RM_101')?.get('TS_MON_P1');
    expect(cell).toEqual({ seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false });
  });

  it('applies the same ratio to every time slot a multi-period class spans', () => {
    const cls = makeClass({ timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'] });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.get('RM_101')?.get('TS_MON_P1')?.seatFillRatio).toBe(0.8);
    expect(result.get('RM_101')?.get('TS_MON_P2')?.seatFillRatio).toBe(0.8);
  });

  it('sums seat-fill and flags hasConflict when two classes share a room+slot', () => {
    const clsA = makeClass({ id: 'CLS_001' });
    const clsB = makeClass({ id: 'CLS_002', studentGroupId: 'GRP_BIO_Y1' });
    const result = aggregateOccupancy([clsA, clsB], [ROOM], [GROUP]);
    const cell = result.get('RM_101')?.get('TS_MON_P1');
    expect(cell).toEqual({ seatFillRatio: 1.6, classIds: ['CLS_001', 'CLS_002'], hasConflict: true });
  });

  it('skips a class whose room is missing from the rooms list', () => {
    const cls = makeClass({ roomId: 'RM_UNKNOWN' });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });

  it('skips a class whose student group is missing from the groups list', () => {
    const cls = makeClass({ studentGroupId: 'GRP_UNKNOWN' });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });
});
