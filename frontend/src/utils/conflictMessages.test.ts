import { describe, it, expect } from 'vitest';
import { getConflictMessage } from './conflictMessages';

describe('getConflictMessage', () => {
  it('ROOM_DOUBLE_BOOK returns a plain English sentence with room name', () => {
    const msg = getConflictMessage('ROOM_DOUBLE_BOOK', '101');
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

  it('is a pure function — same inputs always produce same output', () => {
    expect(getConflictMessage('ROOM_DOUBLE_BOOK', 'Lab A'))
      .toBe(getConflictMessage('ROOM_DOUBLE_BOOK', 'Lab A'));
  });
});
