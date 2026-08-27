import { describe, it, expect } from 'vitest';
import { buildOverlayBlocks } from './overlayLayout';
import type { RawTimeSlot, ScheduleClass } from '@/types';

const ts = (id: string, day: string, startTime: string, endTime: string): RawTimeSlot => ({
  id, day, name: id, startTime, endTime,
});

const TIME_SLOTS: RawTimeSlot[] = [
  ts('TS_MON_P1', 'Monday', '08:30', '10:15'),
  ts('TS_MON_P2', 'Monday', '10:30', '12:15'),
  ts('TS_TUE_P1', 'Tuesday', '09:00', '11:30'),
];
const timeSlotById = new Map(TIME_SLOTS.map((t) => [t.id, t]));

const cls = (id: string, timeSlotIds: string[]): ScheduleClass => ({
  id,
  courseId: 'CRS_BIO101',
  title: `Class ${id}`,
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds,
});

describe('buildOverlayBlocks', () => {
  it('tags each block with its source', () => {
    const blocks = buildOverlayBlocks(
      [{ source: 'room', classes: [cls('CLS_A', ['TS_MON_P1'])] }],
      timeSlotById,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ source: 'room', classId: 'CLS_A', day: 'Monday' });
  });

  it('keeps the real classId, not the tagged composite id', () => {
    const blocks = buildOverlayBlocks(
      [{ source: 'professor', classes: [cls('CLS_A', ['TS_MON_P1'])] }],
      timeSlotById,
    );
    expect(blocks[0]!.classId).toBe('CLS_A');
  });

  it('keeps two different sources at the same time in separate lanes rather than merging them', () => {
    const blocks = buildOverlayBlocks(
      [
        { source: 'room', classes: [cls('CLS_A', ['TS_MON_P1'])] },
        { source: 'professor', classes: [cls('CLS_B', ['TS_MON_P1'])] },
      ],
      timeSlotById,
    );
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((b) => b.laneIndex)).size).toBe(2);
    expect(blocks.every((b) => b.laneCount === 2)).toBe(true);
  });

  it('renders the same underlying class twice when it satisfies two sources at once', () => {
    // Some other class happens to already occupy both the room and the
    // professor being tried — both should surface, not be deduped away.
    const shared = cls('CLS_SHARED', ['TS_MON_P1']);
    const blocks = buildOverlayBlocks(
      [
        { source: 'room', classes: [shared] },
        { source: 'professor', classes: [shared] },
      ],
      timeSlotById,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.classId)).toEqual(['CLS_SHARED', 'CLS_SHARED']);
    expect(new Set(blocks.map((b) => b.source))).toEqual(new Set(['room', 'professor']));
  });

  it('does not lane-collide blocks on different days or non-overlapping times', () => {
    const blocks = buildOverlayBlocks(
      [
        { source: 'room', classes: [cls('CLS_A', ['TS_MON_P1'])] },
        { source: 'group', classes: [cls('CLS_B', ['TS_TUE_P1'])] },
      ],
      timeSlotById,
    );
    expect(blocks.every((b) => b.laneCount === 1 && b.laneIndex === 0)).toBe(true);
  });

  it('returns an empty array when nothing is scheduled', () => {
    expect(buildOverlayBlocks([{ source: 'room', classes: [] }], timeSlotById)).toEqual([]);
  });
});
