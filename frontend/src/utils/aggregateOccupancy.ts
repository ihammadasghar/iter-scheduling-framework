import type { ScheduleClass, RawRoom, RawStudentGroup } from '@/types';

export interface OccupancyCell {
  readonly seatFillRatio: number;
  readonly classIds: readonly string[];
  // Structural room+slot overlap detected locally here, independent of the
  // backend's conflictSlice — by design, not something to unify with the Gantt.
  readonly hasConflict: boolean;
}

export type OccupancyLookup = ReadonlyMap<string, ReadonlyMap<string, OccupancyCell>>;

/**
 * Per-cell seat-fill density for the Room Utilisation Heatmap: for each
 * booked room+time-slot, studentGroup.size / room.capacity. A cell absent
 * from the returned map is unbooked (rendered as neutral, not zero).
 * Overlapping classes (a ROOM_DOUBLE_BOOK conflict) sum their ratios and
 * set hasConflict — the heatmap surfaces this with an icon, not a color blend.
 */
export const aggregateOccupancy = (
  classes: readonly ScheduleClass[],
  rooms: readonly RawRoom[],
  studentGroups: readonly RawStudentGroup[],
): OccupancyLookup => {
  const roomCapacity = new Map(rooms.map((r) => [r.id, r.capacity]));
  const groupSize = new Map(studentGroups.map((g) => [g.id, g.size]));

  const lookup = new Map<string, Map<string, OccupancyCell>>();

  classes.forEach((cls) => {
    const capacity = roomCapacity.get(cls.roomId);
    const size = groupSize.get(cls.studentGroupId);
    if (capacity === undefined || size === undefined || capacity <= 0) return;
    const ratio = size / capacity;

    cls.timeSlotIds.forEach((tsId) => {
      if (!lookup.has(cls.roomId)) lookup.set(cls.roomId, new Map());
      const roomMap = lookup.get(cls.roomId)!;
      const existing = roomMap.get(tsId);
      if (existing === undefined) {
        roomMap.set(tsId, { seatFillRatio: ratio, classIds: [cls.id], hasConflict: false });
      } else {
        roomMap.set(tsId, {
          seatFillRatio: existing.seatFillRatio + ratio,
          classIds: [...existing.classIds, cls.id],
          hasConflict: true,
        });
      }
    });
  });

  return lookup;
};
