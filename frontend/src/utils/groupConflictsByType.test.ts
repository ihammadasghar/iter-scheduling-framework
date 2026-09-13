import { describe, it, expect } from 'vitest';
import { createIntl } from 'react-intl';
import { groupConflictsByType, isPolicyViolation } from './groupConflictsByType';
import type { Conflict } from '@/types';

const intl = createIntl({ locale: 'en', messages: {} });

const makeConflict = (type: Conflict['type'], id: string): Conflict => ({
  id,
  type,
  classIds: ['CLS_001', 'CLS_002'],
  message: '',
});

describe('groupConflictsByType', () => {
  it('returns all 6 types with count 0 when there are no conflicts', () => {
    expect(groupConflictsByType(intl, [])).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 0 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 0 },
      { type: 'ROOM_CAPACITY_EXCEEDED', label: 'Room over capacity', count: 0 },
      { type: 'CONSECUTIVE_LIMIT_EXCEEDED', label: 'Consecutive periods exceeded', count: 0 },
      { type: 'GAP_LIMIT_EXCEEDED', label: 'Gap limit exceeded', count: 0 },
    ]);
  });

  it('counts conflicts by type in fixed order regardless of input order', () => {
    const conflicts = [
      makeConflict('GROUP_OVERLAP', 'c1'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c2'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c3'),
      makeConflict('CONSECUTIVE_LIMIT_EXCEEDED', 'c4'),
    ];
    expect(groupConflictsByType(intl, conflicts)).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 2 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 1 },
      { type: 'ROOM_CAPACITY_EXCEEDED', label: 'Room over capacity', count: 0 },
      { type: 'CONSECUTIVE_LIMIT_EXCEEDED', label: 'Consecutive periods exceeded', count: 1 },
      { type: 'GAP_LIMIT_EXCEEDED', label: 'Gap limit exceeded', count: 0 },
    ]);
  });

  it('isPolicyViolation distinguishes policy constraint types from structural ones', () => {
    expect(isPolicyViolation('CONSECUTIVE_LIMIT_EXCEEDED')).toBe(true);
    expect(isPolicyViolation('GAP_LIMIT_EXCEEDED')).toBe(true);
    expect(isPolicyViolation('ROOM_DOUBLE_BOOK')).toBe(false);
    expect(isPolicyViolation('PROFESSOR_OVERLAP')).toBe(false);
    expect(isPolicyViolation('GROUP_OVERLAP')).toBe(false);
    expect(isPolicyViolation('ROOM_CAPACITY_EXCEEDED')).toBe(false);
  });
});
