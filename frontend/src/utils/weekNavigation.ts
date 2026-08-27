// Pure week-math helpers powering "previous/next week" navigation on the
// weekly calendar views. No React/Redux — fully unit-testable in isolation,
// mirroring calendarLayout.ts's style.
//
// All semester/exclusion dates are date-only strings ("YYYY-MM-DD", no
// time component). RULE: always use the getUTC*/setUTC*/Date.UTC family
// here, never local-timezone getters (.getDate(), .getDay(), etc. without
// the UTC prefix) — a bare "YYYY-MM-DD" parses as UTC midnight, and reading
// it back with local-time getters can silently roll the date over by one
// for any caller west of UTC. Every function below stays in UTC space from
// parse to format.
import { DAY_REFERENCE_ORDER } from './calendarLayout';
import type { ScheduleTimeline } from '@/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses "YYYY-MM-DD" into a UTC-midnight Date. */
export const parseDateOnly = (dateStr: string): Date => new Date(`${dateStr}T00:00:00.000Z`);

/** Formats a UTC-midnight Date back to "YYYY-MM-DD". */
export const formatDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateStr: string, days: number): string =>
  formatDateOnly(new Date(parseDateOnly(dateStr).getTime() + days * MS_PER_DAY));

/** The Monday on/before the given date (UTC), as "YYYY-MM-DD". */
export const mondayOf = (dateStr: string): string => {
  const dow = parseDateOnly(dateStr).getUTCDay(); // 0=Sunday..6=Saturday
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  return addDays(dateStr, -offsetFromMonday);
};

/**
 * Clamps a candidate week-start (any date; not required to already be a
 * Monday) into [semesterStartDate's week, semesterEndDate's week] — used
 * both for explicit navigation targets and for computing the initial week.
 */
export const clampWeekStart = (weekStart: string, timeline: ScheduleTimeline): string => {
  const monday = mondayOf(weekStart);
  const firstWeek = mondayOf(timeline.semesterStartDate);
  const lastWeek = mondayOf(timeline.semesterEndDate);
  if (monday < firstWeek) return firstWeek;
  if (monday > lastWeek) return lastWeek;
  return monday;
};

/** Today's Monday-anchored week, clamped into the semester's bounds. */
export const initialWeekStart = (timeline: ScheduleTimeline): string =>
  clampWeekStart(formatDateOnly(new Date()), timeline);

/**
 * One week earlier/later, clamped to semester bounds — never steps past a
 * boundary week even if called repeatedly (idempotent once at an edge).
 * Pair with canGoPrev/canGoNext to decide whether to disable a button.
 */
export const stepWeek = (
  weekStart: string,
  direction: 'prev' | 'next',
  timeline: ScheduleTimeline,
): string => clampWeekStart(addDays(weekStart, direction === 'next' ? 7 : -7), timeline);

/**
 * True iff stepping one week further still overlaps the semester — i.e.
 * the *next* week's Monday isn't past the semester's last week. The
 * semester's final week may start mid-week before semesterEndDate and is
 * still a valid week to view, so this compares week-Mondays, not raw dates.
 */
export const canGoNext = (weekStart: string, timeline: ScheduleTimeline): boolean =>
  addDays(mondayOf(weekStart), 7) <= mondayOf(timeline.semesterEndDate);

export const canGoPrev = (weekStart: string, timeline: ScheduleTimeline): boolean =>
  addDays(mondayOf(weekStart), -7) >= mondayOf(timeline.semesterStartDate);

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const MONTH_DAY_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Sep 7 – Sep 13, 2026" style human label for the Mon–Sun week starting weekStart. */
export const formatWeekRangeLabel = (weekStart: string): string => {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDays(weekStart, 6));
  return `${MONTH_DAY_FORMATTER.format(start)} – ${MONTH_DAY_YEAR_FORMATTER.format(end)}`;
};

/**
 * For the week starting weekStart, maps each excluded day's weekday name
 * (as used in RawTimeSlot.day / DAY_REFERENCE_ORDER, e.g. "Wednesday") to
 * its exclusion reason. Days not excluded that week are simply absent from
 * the map — callers use `.has(day)`/`.get(day)`, never an empty-string
 * sentinel.
 */
export const excludedDaysForWeek = (
  weekStart: string,
  timeline: ScheduleTimeline,
): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  DAY_REFERENCE_ORDER.forEach((dayName, offset) => {
    const date = addDays(weekStart, offset);
    const hit = timeline.exclusionDates.find((ex) => ex.date === date);
    if (hit) map.set(dayName, hit.reason);
  });
  return map;
};
