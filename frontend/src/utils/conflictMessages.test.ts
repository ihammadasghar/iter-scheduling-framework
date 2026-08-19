import { describe, it, expect } from 'vitest';
import { getConflictMessage, resolveConflictResourceName, describeConflict } from './conflictMessages';
import type { Conflict, ScheduleClass } from '@/types';

describe('getConflictMessage', () => {
  it('ROOM_DOUBLE_BOOK returns a plain English sentence with room name', () => {
    // resourceName is always already-formatted (via formatRoomLabel) by the
    // time it reaches here — must not add its own "Room " prefix on top,
    // or a numeric room reads as "Room Room 101 is booked...".
    const msg = getConflictMessage('ROOM_DOUBLE_BOOK', 'Room 101');
    expect(msg).toBe('Room 101 is booked for two classes at the same time');
    // Must not contain the type code
    expect(msg).not.toContain('ROOM_DOUBLE_BOOK');
  });

  it('PROFESSOR_OVERLAP returns a plain English sentence with professor name', () => {
    const msg = getConflictMessage('PROFESSOR_OVERLAP', 'Smith');
    expect(msg).toBe('Smith is already teaching another class at this time');
    expect(msg).not.toContain('PROFESSOR_OVERLAP');
  });

  it('GROUP_OVERLAP returns a plain English sentence with group name', () => {
    const msg = getConflictMessage('GROUP_OVERLAP', 'Bio Y1');
    expect(msg).toBe('Bio Y1 students are in two classes at once');
    expect(msg).not.toContain('GROUP_OVERLAP');
  });

  it('ROOM_CAPACITY_EXCEEDED returns a plain English sentence with the combined resource name', () => {
    const msg = getConflictMessage('ROOM_CAPACITY_EXCEEDED', 'Bio Y1 in Room 101');
    expect(msg).toBe("Bio Y1 in Room 101 exceeds the room's capacity");
    expect(msg).not.toContain('ROOM_CAPACITY_EXCEEDED');
  });

  it('is a pure function — same inputs always produce same output', () => {
    expect(getConflictMessage('ROOM_DOUBLE_BOOK', 'Lab A'))
      .toBe(getConflictMessage('ROOM_DOUBLE_BOOK', 'Lab A'));
  });
});

const classA: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const classB: ScheduleClass = { ...classA, id: 'CLS_002', roomId: 'RM_LAB_A' };

describe('resolveConflictResourceName', () => {
  it('resolves the numeric room label for ROOM_DOUBLE_BOOK without a doubled "Room" prefix', () => {
    const conflict: Conflict = {
      id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '',
    };
    expect(resolveConflictResourceName(conflict, [classA, classB])).toBe('Room 101');
  });

  it('resolves a named room label for ROOM_DOUBLE_BOOK', () => {
    const conflict: Conflict = {
      id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_002', 'CLS_001'], message: '',
    };
    expect(resolveConflictResourceName(conflict, [classA, classB])).toBe('Lab A');
  });
});

describe('describeConflict', () => {
  it('combines resolveConflictResourceName + getConflictMessage into one clean sentence (no "Room Room")', () => {
    const conflict: Conflict = {
      id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '',
    };
    expect(describeConflict(conflict, [classA, classB]))
      .toBe('Room 101 is booked for two classes at the same time');
  });
});
