import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  deriveDayOrder,
  computeCalendarBounds,
  filterByResource,
  filterMine,
  layoutDay,
  buildCalendarBlocks,
  computeContiguousSlotIds,
  findAvailableStarts,
} from './calendarLayout';
import type { RawTimeSlot, ScheduleClass, Identity } from '@/types';

const ts = (id: string, day: string, startTime: string, endTime: string): RawTimeSlot => ({
  id, day, name: id, startTime, endTime,
});

const TIME_SLOTS: RawTimeSlot[] = [
  ts('TS_MON_P1', 'Monday', '08:30', '10:15'),
  ts('TS_MON_P2', 'Monday', '10:30', '12:15'),
  ts('TS_TUE_P1', 'Tuesday', '09:00', '11:30'),
  ts('TS_WED_P1', 'Wednesday', '08:30', '10:15'),
];

const timeSlotById = new Map(TIME_SLOTS.map((t) => [t.id, t]));

const cls = (overrides: Partial<ScheduleClass>): ScheduleClass => ({
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Class',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
  ...overrides,
});

describe('timeToMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('deriveDayOrder', () => {
  it('returns distinct days present, sorted Mon→Sun regardless of input order', () => {
    const shuffled = [TIME_SLOTS[2]!, TIME_SLOTS[0]!, TIME_SLOTS[3]!, TIME_SLOTS[1]!];
    expect(deriveDayOrder(shuffled)).toEqual(['Monday', 'Tuesday', 'Wednesday']);
  });

  it('returns an empty array for no time slots', () => {
    expect(deriveDayOrder([])).toEqual([]);
  });
});

describe('computeCalendarBounds', () => {
  it('finds the earliest start and latest end across all slots', () => {
    expect(computeCalendarBounds(TIME_SLOTS)).toEqual({ minMinutes: 510, maxMinutes: 735 });
  });

  it('falls back to a sane default when there are no time slots', () => {
    expect(computeCalendarBounds([])).toEqual({ minMinutes: 480, maxMinutes: 1080 });
  });
});

describe('filterByResource', () => {
  const classes = [
    cls({ id: 'CLS_A', roomId: 'RM_101', professorId: 'PRF_SMITH', studentGroupId: 'GRP_BIO_Y1' }),
    cls({ id: 'CLS_B', roomId: 'RM_202', professorId: 'PRF_JONES', studentGroupId: 'GRP_HIS_Y1' }),
  ];

  it('filters by room', () => {
    expect(filterByResource(classes, 'room', 'RM_202').map((c) => c.id)).toEqual(['CLS_B']);
  });

  it('filters by professor', () => {
    expect(filterByResource(classes, 'professor', 'PRF_SMITH').map((c) => c.id)).toEqual(['CLS_A']);
  });

  it('filters by student group', () => {
    expect(filterByResource(classes, 'studentGroup', 'GRP_HIS_Y1').map((c) => c.id)).toEqual(['CLS_B']);
  });

  it('returns an empty array when no class matches the given resource id', () => {
    expect(filterByResource(classes, 'room', 'RM_NONEXISTENT')).toEqual([]);
  });
});

describe('filterMine', () => {
  const classes = [
    cls({ id: 'CLS_A', professorId: 'PRF_SMITH', studentGroupId: 'GRP_BIO_Y1' }),
    cls({ id: 'CLS_B', professorId: 'PRF_JONES', studentGroupId: 'GRP_HIS_Y1' }),
  ];

  it('returns only the signed-in professor\'s classes', () => {
    const identity: Identity = { role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null };
    expect(filterMine(classes, identity).map((c) => c.id)).toEqual(['CLS_A']);
  });

  it('returns only the signed-in student group\'s classes', () => {
    const identity: Identity = { role: 'student', professorId: null, studentGroupId: 'GRP_HIS_Y1' };
    expect(filterMine(classes, identity).map((c) => c.id)).toEqual(['CLS_B']);
  });

  it('returns an empty array for admin (no personal schedule)', () => {
    const identity: Identity = { role: 'admin', professorId: null, studentGroupId: null };
    expect(filterMine(classes, identity)).toEqual([]);
  });

  it('returns an empty array when identity is null', () => {
    expect(filterMine(classes, null)).toEqual([]);
  });
});

describe('layoutDay', () => {
  it('gives every block laneCount 1 when nothing overlaps', () => {
    const blocks = layoutDay([
      { classId: 'A', day: 'Monday', startMinutes: 0, endMinutes: 60 },
      { classId: 'B', day: 'Monday', startMinutes: 60, endMinutes: 120 },
    ]);
    expect(blocks.every((b) => b.laneCount === 1 && b.laneIndex === 0)).toBe(true);
  });

  it('assigns distinct lanes to two overlapping blocks', () => {
    const blocks = layoutDay([
      { classId: 'A', day: 'Monday', startMinutes: 0, endMinutes: 60 },
      { classId: 'B', day: 'Monday', startMinutes: 30, endMinutes: 90 },
    ]);
    const a = blocks.find((b) => b.classId === 'A')!;
    const b = blocks.find((b) => b.classId === 'B')!;
    expect(a.laneCount).toBe(2);
    expect(b.laneCount).toBe(2);
    expect(a.laneIndex).not.toBe(b.laneIndex);
  });

  it('does not widen an unrelated non-overlapping cluster elsewhere in the day', () => {
    const blocks = layoutDay([
      { classId: 'A', day: 'Monday', startMinutes: 0, endMinutes: 60 },
      { classId: 'B', day: 'Monday', startMinutes: 30, endMinutes: 90 },
      { classId: 'C', day: 'Monday', startMinutes: 200, endMinutes: 260 },
    ]);
    expect(blocks.find((b) => b.classId === 'C')!.laneCount).toBe(1);
  });

  it('reuses a freed lane once its previous occupant has ended', () => {
    const blocks = layoutDay([
      { classId: 'A', day: 'Monday', startMinutes: 0, endMinutes: 30 },
      { classId: 'B', day: 'Monday', startMinutes: 0, endMinutes: 30 },
      { classId: 'C', day: 'Monday', startMinutes: 30, endMinutes: 60 },
    ]);
    // A and B overlap (2 lanes needed); C starts exactly when both end, so
    // it can reuse lane 0 and the cluster never needed a 3rd lane.
    expect(blocks.find((b) => b.classId === 'C')!.laneIndex).toBe(0);
  });
});

describe('buildCalendarBlocks', () => {
  it('produces one block per class on its day', () => {
    const blocks = buildCalendarBlocks(
      [cls({ id: 'CLS_A', timeSlotIds: ['TS_MON_P1'] })],
      timeSlotById,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ classId: 'CLS_A', day: 'Monday', startMinutes: 510, endMinutes: 615 });
  });

  it('merges a multi-slot same-day class into one spanning block', () => {
    const blocks = buildCalendarBlocks(
      [cls({ id: 'CLS_A', timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'] })],
      timeSlotById,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startMinutes: 510, endMinutes: 735 });
  });

  it('ignores timeSlotIds that are not in the lookup', () => {
    const blocks = buildCalendarBlocks(
      [cls({ id: 'CLS_A', timeSlotIds: ['TS_UNKNOWN'] })],
      timeSlotById,
    );
    expect(blocks).toEqual([]);
  });

  it('lays out overlapping classes on the same day into separate lanes', () => {
    const blocks = buildCalendarBlocks(
      [
        cls({ id: 'CLS_A', timeSlotIds: ['TS_MON_P1'] }),
        cls({ id: 'CLS_B', timeSlotIds: ['TS_MON_P1'] }),
      ],
      timeSlotById,
    );
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((b) => b.laneIndex)).size).toBe(2);
  });
});

describe('computeContiguousSlotIds', () => {
  const mondaySlots = [TIME_SLOTS[0]!, TIME_SLOTS[1]!];

  it('returns a single-element array for count=1', () => {
    expect(computeContiguousSlotIds(mondaySlots, 'TS_MON_P1', 1)).toEqual(['TS_MON_P1']);
  });

  it('returns the next contiguous slots for count>1', () => {
    expect(computeContiguousSlotIds(mondaySlots, 'TS_MON_P1', 2)).toEqual(['TS_MON_P1', 'TS_MON_P2']);
  });

  it('returns null when the day does not have enough remaining slots', () => {
    expect(computeContiguousSlotIds(mondaySlots, 'TS_MON_P2', 2)).toBeNull();
  });

  it('returns null when the start slot is not found', () => {
    expect(computeContiguousSlotIds(mondaySlots, 'TS_UNKNOWN', 1)).toBeNull();
  });
});

describe('findAvailableStarts', () => {
  const mondaySlots = [
    ts('TS_MON_P1', 'Monday', '08:30', '10:15'),
    ts('TS_MON_P2', 'Monday', '10:30', '12:15'),
    ts('TS_MON_P3', 'Monday', '12:30', '14:15'),
  ];

  it('returns every free slot as its own start when count=1', () => {
    const free = new Set(['TS_MON_P1', 'TS_MON_P3']);
    expect(findAvailableStarts(mondaySlots, free, 1)).toEqual(['TS_MON_P1', 'TS_MON_P3']);
  });

  it('returns no starts when nothing is free', () => {
    expect(findAvailableStarts(mondaySlots, new Set(), 1)).toEqual([]);
  });

  it('excludes a free slot whose run would cross into a busy slot', () => {
    // P1 and P2 are individually free, but P3 (needed to complete a 2-period
    // run starting at P2) is not — so P2 must not be offered as a start.
    const free = new Set(['TS_MON_P1', 'TS_MON_P2']);
    expect(findAvailableStarts(mondaySlots, free, 2)).toEqual(['TS_MON_P1']);
  });

  it('excludes a free slot too close to the end of the day for the run length', () => {
    const free = new Set(['TS_MON_P1', 'TS_MON_P2', 'TS_MON_P3']);
    expect(findAvailableStarts(mondaySlots, free, 2)).toEqual(['TS_MON_P1', 'TS_MON_P2']);
    expect(findAvailableStarts(mondaySlots, free, 3)).toEqual(['TS_MON_P1']);
  });
});
