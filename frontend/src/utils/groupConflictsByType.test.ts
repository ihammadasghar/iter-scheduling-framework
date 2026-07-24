import { describe, it, expect } from 'vitest';
import { groupConflictsByType } from './groupConflictsByType';
import type { Conflict } from '@/types';

const makeConflict = (type: Conflict['type'], id: string): Conflict => ({
  id,
  type,
  classIds: ['CLS_001', 'CLS_002'],
  message: '',
});

describe('groupConflictsByType', () => {
  it('returns all 3 types with count 0 when there are no conflicts', () => {
    expect(groupConflictsByType([])).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 0 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 0 },
    ]);
  });

  it('counts conflicts by type in fixed order regardless of input order', () => {
    const conflicts = [
      makeConflict('GROUP_OVERLAP', 'c1'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c2'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c3'),
    ];
    expect(groupConflictsByType(conflicts)).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 2 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 1 },
    ]);
  });
});
