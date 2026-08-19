import type { Conflict, ConflictType } from '@/types';

export interface ConflictTypeCount {
  readonly type: ConflictType;
  readonly label: string;
  readonly count: number;
}

const CONFLICT_TYPE_LABELS: Readonly<Record<ConflictType, string>> = {
  ROOM_DOUBLE_BOOK: 'Room double-booked',
  PROFESSOR_OVERLAP: 'Lecturer double-booked',
  GROUP_OVERLAP: 'Student group overlap',
  ROOM_CAPACITY_EXCEEDED: 'Room over capacity',
};

const CONFLICT_TYPE_ORDER: readonly ConflictType[] = [
  'ROOM_DOUBLE_BOOK',
  'PROFESSOR_OVERLAP',
  'GROUP_OVERLAP',
  'ROOM_CAPACITY_EXCEEDED',
];

export const groupConflictsByType = (
  conflicts: readonly Conflict[],
): readonly ConflictTypeCount[] => {
  const counts = new Map<ConflictType, number>();
  conflicts.forEach((c) => counts.set(c.type, (counts.get(c.type) ?? 0) + 1));

  return CONFLICT_TYPE_ORDER.map((type) => ({
    type,
    label: CONFLICT_TYPE_LABELS[type],
    count: counts.get(type) ?? 0,
  }));
};
