// Pure geometry helpers for MyScheduleCalendar.tsx — no React, fully
// unit-testable in isolation. Converts a signed-in professor/student's
// classes into a real weekly-calendar layout: which day column, where on
// the time axis, and (when two of their own classes overlap) which
// side-by-side lane, à la Google Calendar.
import type { RawTimeSlot, ScheduleClass, Identity, ViewByOption } from '@/types';

// Fixed reference order so day columns are always Mon→Sun regardless of
// which days happen to appear in a given dataset's time slots (the mock
// fixture only has Mon–Wed; other datasets may include Saturday).
const DAY_REFERENCE_ORDER = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** "08:30" → 510 (minutes since midnight). */
export const timeToMinutes = (hhmm: string): number => {
  const [hours = 0, minutes = 0] = hhmm.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

/** Distinct days present in the roster's time slots, in Mon→Sun order. */
export const deriveDayOrder = (timeSlots: readonly RawTimeSlot[]): string[] => {
  const present = new Set(timeSlots.map((ts) => ts.day));
  return DAY_REFERENCE_ORDER.filter((day) => present.has(day));
};

export interface CalendarBounds {
  readonly minMinutes: number;
  readonly maxMinutes: number;
}

const DEFAULT_BOUNDS: CalendarBounds = { minMinutes: 8 * 60, maxMinutes: 18 * 60 };

/** The earliest start / latest end across all time slots — the calendar's vertical extent. */
export const computeCalendarBounds = (timeSlots: readonly RawTimeSlot[]): CalendarBounds => {
  if (timeSlots.length === 0) return DEFAULT_BOUNDS;
  let minMinutes = Infinity;
  let maxMinutes = -Infinity;
  timeSlots.forEach((ts) => {
    minMinutes = Math.min(minMinutes, timeToMinutes(ts.startTime));
    maxMinutes = Math.max(maxMinutes, timeToMinutes(ts.endTime));
  });
  return { minMinutes, maxMinutes };
};

/** Classes belonging to one specific room, professor, or student group — the general case `filterMine` (below) and the Browse tab both build on. */
export const filterByResource = (
  classes: readonly ScheduleClass[],
  resourceType: ViewByOption,
  resourceId: string,
): ScheduleClass[] => {
  if (resourceType === 'room') return classes.filter((c) => c.roomId === resourceId);
  if (resourceType === 'professor') return classes.filter((c) => c.professorId === resourceId);
  return classes.filter((c) => c.studentGroupId === resourceId);
};

/** Only the classes belonging to the signed-in professor/student — empty for admin (no personal schedule) or no identity. */
export const filterMine = (
  classes: readonly ScheduleClass[],
  identity: Identity | null,
): ScheduleClass[] => {
  if (identity === null) return [];
  if (identity.role === 'professor' && identity.professorId) {
    return filterByResource(classes, 'professor', identity.professorId);
  }
  if (identity.role === 'student' && identity.studentGroupId) {
    return filterByResource(classes, 'studentGroup', identity.studentGroupId);
  }
  return [];
};

export interface DayEntry {
  readonly classId: string;
  readonly day: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export interface CalendarBlock extends DayEntry {
  // Which side-by-side column this block renders in, and how many columns
  // its overlap cluster needs in total (both 0-indexed-safe: laneCount ≥ 1).
  readonly laneIndex: number;
  readonly laneCount: number;
}

// A class's timeSlotIds are grouped by day defensively (the type doesn't
// guarantee same-day slots, even though today's fixtures always are) —
// each day-group becomes its own DayEntry spanning that day's earliest
// start to latest end, so a class can legitimately produce more than one
// block if it ever meets on multiple days.
export const buildDayEntries = (
  classes: readonly ScheduleClass[],
  timeSlotById: ReadonlyMap<string, RawTimeSlot>,
): DayEntry[] => {
  const entries: DayEntry[] = [];

  classes.forEach((cls) => {
    const slots = cls.timeSlotIds
      .map((id) => timeSlotById.get(id))
      .filter((ts): ts is RawTimeSlot => ts !== undefined);
    if (slots.length === 0) return;

    const byDay = new Map<string, RawTimeSlot[]>();
    slots.forEach((ts) => {
      const list = byDay.get(ts.day) ?? [];
      list.push(ts);
      byDay.set(ts.day, list);
    });

    byDay.forEach((daySlots, day) => {
      entries.push({
        classId: cls.id,
        day,
        startMinutes: Math.min(...daySlots.map((ts) => timeToMinutes(ts.startTime))),
        endMinutes: Math.max(...daySlots.map((ts) => timeToMinutes(ts.endTime))),
      });
    });
  });

  return entries;
};

// Classic calendar "collision cluster" layout: process entries sorted by
// start time, grouping consecutive overlapping entries into a cluster and
// greedily assigning each to the first free column. laneCount is the
// number of columns a *cluster* needed — not a global max — so a busy hour
// elsewhere in the day doesn't widen an unrelated pair of blocks.
export const layoutDay = (entries: readonly DayEntry[]): CalendarBlock[] => {
  const sorted = [...entries].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );

  const result: CalendarBlock[] = [];
  let cluster: Array<{ entry: DayEntry; lane: number }> = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = (): void => {
    const laneCount = columnEnds.length;
    cluster.forEach(({ entry, lane }) => {
      result.push({ ...entry, laneIndex: lane, laneCount });
    });
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((entry) => {
    if (cluster.length > 0 && entry.startMinutes >= clusterEnd) {
      flushCluster();
    }
    let lane = columnEnds.findIndex((end) => end <= entry.startMinutes);
    if (lane === -1) {
      lane = columnEnds.length;
      columnEnds.push(entry.endMinutes);
    } else {
      columnEnds[lane] = entry.endMinutes;
    }
    cluster.push({ entry, lane });
    clusterEnd = Math.max(clusterEnd, entry.endMinutes);
  });
  flushCluster();

  return result;
};

/** Full layout: classes + time-slot lookup → positioned/laned calendar blocks, grouped by day. */
export const buildCalendarBlocks = (
  classes: readonly ScheduleClass[],
  timeSlotById: ReadonlyMap<string, RawTimeSlot>,
): CalendarBlock[] => {
  const entries = buildDayEntries(classes, timeSlotById);
  const byDay = new Map<string, DayEntry[]>();
  entries.forEach((entry) => {
    const list = byDay.get(entry.day) ?? [];
    list.push(entry);
    byDay.set(entry.day, list);
  });

  const blocks: CalendarBlock[] = [];
  byDay.forEach((dayEntries) => blocks.push(...layoutDay(dayEntries)));
  return blocks;
};

// Used by the manual-reschedule form: preserve a multi-period class's length
// when moving it to a different day, by picking `count` chronologically
// contiguous slots on that day starting at `startSlotId`. Returns null if
// the day doesn't have that many slots left from that starting point.
export const computeContiguousSlotIds = (
  dayTimeSlots: readonly RawTimeSlot[],
  startSlotId: string,
  count: number,
): string[] | null => {
  const sorted = [...dayTimeSlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );
  const startIndex = sorted.findIndex((ts) => ts.id === startSlotId);
  if (startIndex === -1 || startIndex + count > sorted.length) return null;
  return sorted.slice(startIndex, startIndex + count).map((ts) => ts.id);
};

// Used by the Change Room browser: the room-availability endpoint only
// reports which *individual* timeslots are free of conflict for a room
// (same granularity as Smart Suggestions) — turning that into the
// contiguous multi-period runs a class actually needs is a frontend concern,
// reusing computeContiguousSlotIds above. Tries every free slot in the day
// as a candidate run start and keeps the ones whose whole run is free.
export const findAvailableStarts = (
  dayTimeSlots: readonly RawTimeSlot[],
  freeSlotIds: ReadonlySet<string>,
  count: number,
): string[] => {
  const candidates = dayTimeSlots.filter((ts) => freeSlotIds.has(ts.id));
  const starts: string[] = [];
  candidates.forEach((ts) => {
    const run = computeContiguousSlotIds(dayTimeSlots, ts.id, count);
    if (run !== null && run.every((id) => freeSlotIds.has(id))) {
      starts.push(ts.id);
    }
  });
  return starts;
};
