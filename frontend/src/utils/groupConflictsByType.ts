import { defineMessages, type IntlShape } from 'react-intl';
import type { Conflict, ConflictType } from '@/types';

export interface ConflictTypeCount {
  readonly type: ConflictType;
  readonly label: string;
  readonly count: number;
}

const messages = defineMessages({
  ROOM_DOUBLE_BOOK: { id: 'groupConflictsByType.roomDoubleBook', defaultMessage: 'Room double-booked' },
  PROFESSOR_OVERLAP: { id: 'groupConflictsByType.professorOverlap', defaultMessage: 'Professor double-booked' },
  GROUP_OVERLAP: { id: 'groupConflictsByType.groupOverlap', defaultMessage: 'Student group overlap' },
  ROOM_CAPACITY_EXCEEDED: { id: 'groupConflictsByType.roomCapacityExceeded', defaultMessage: 'Room over capacity' },
  CONSECUTIVE_LIMIT_EXCEEDED: { id: 'groupConflictsByType.consecutiveLimitExceeded', defaultMessage: 'Consecutive periods exceeded' },
  GAP_LIMIT_EXCEEDED: { id: 'groupConflictsByType.gapLimitExceeded', defaultMessage: 'Gap limit exceeded' },
});

const CONFLICT_TYPE_ORDER: readonly ConflictType[] = [
  'ROOM_DOUBLE_BOOK',
  'PROFESSOR_OVERLAP',
  'GROUP_OVERLAP',
  'ROOM_CAPACITY_EXCEEDED',
  'CONSECUTIVE_LIMIT_EXCEEDED',
  'GAP_LIMIT_EXCEEDED',
];

// Institution-authored policy constraints (consecutive_limit/gap_limit, set
// via the Rule Builder) vs. the other 4 always-on structural checks
// (physical impossibilities like double-booking) — lets the UI label the
// two kinds distinctly, e.g. ConflictsComparisonPanel's "Scheduling rule
// violated:" prefix.
const POLICY_CONFLICT_TYPES: ReadonlySet<ConflictType> = new Set([
  'CONSECUTIVE_LIMIT_EXCEEDED',
  'GAP_LIMIT_EXCEEDED',
]);

export const isPolicyViolation = (type: ConflictType): boolean => POLICY_CONFLICT_TYPES.has(type);

export const groupConflictsByType = (
  intl: IntlShape,
  conflicts: readonly Conflict[],
): readonly ConflictTypeCount[] => {
  const counts = new Map<ConflictType, number>();
  conflicts.forEach((c) => counts.set(c.type, (counts.get(c.type) ?? 0) + 1));

  return CONFLICT_TYPE_ORDER.map((type) => ({
    type,
    label: intl.formatMessage(messages[type]),
    count: counts.get(type) ?? 0,
  }));
};
