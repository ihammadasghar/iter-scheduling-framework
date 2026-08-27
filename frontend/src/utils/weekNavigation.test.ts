import { describe, it, expect } from 'vitest';
import {
  parseDateOnly,
  formatDateOnly,
  mondayOf,
  clampWeekStart,
  initialWeekStart,
  stepWeek,
  canGoPrev,
  canGoNext,
  formatWeekRangeLabel,
  excludedDaysForWeek,
} from './weekNavigation';
import type { ScheduleTimeline } from '@/types';

// Fall 2026, matching the real fixture shape: semester runs Mon Sep 7 –
// Fri Dec 18, one holiday (Thanksgiving) on Thu Nov 26.
const TIMELINE: ScheduleTimeline = {
  semesterStartDate: '2026-09-07',
  semesterEndDate: '2026-12-18',
  exclusionDates: [{ date: '2026-11-26', reason: 'Thanksgiving Break' }],
};

describe('parseDateOnly / formatDateOnly', () => {
  it('round-trips a date-only string through UTC midnight', () => {
    expect(formatDateOnly(parseDateOnly('2026-11-26'))).toBe('2026-11-26');
  });
});

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-09-07')).toBe('2026-09-07'); // Sep 7, 2026 is a Monday
  });

  it('returns the preceding Monday for a mid-week date', () => {
    expect(mondayOf('2026-11-26')).toBe('2026-11-23'); // Thursday -> that week's Monday
  });

  it('returns the preceding Monday for a Sunday (wraps to the prior week)', () => {
    expect(mondayOf('2026-09-13')).toBe('2026-09-07'); // Sunday -> Monday 6 days earlier
  });
});

describe('clampWeekStart', () => {
  it('leaves an in-bounds week-start unchanged (normalized to its Monday)', () => {
    expect(clampWeekStart('2026-11-26', TIMELINE)).toBe('2026-11-23');
  });

  it('clamps a week before the semester start up to the semester\'s first week', () => {
    expect(clampWeekStart('2026-01-01', TIMELINE)).toBe(mondayOf(TIMELINE.semesterStartDate));
  });

  it('clamps a week after the semester end down to the semester\'s last week', () => {
    expect(clampWeekStart('2027-03-01', TIMELINE)).toBe(mondayOf(TIMELINE.semesterEndDate));
  });
});

describe('canGoPrev / canGoNext', () => {
  const firstWeek = mondayOf(TIMELINE.semesterStartDate);
  const lastWeek = mondayOf(TIMELINE.semesterEndDate);

  it('disables prev exactly at the semester\'s first week', () => {
    expect(canGoPrev(firstWeek, TIMELINE)).toBe(false);
  });

  it('enables prev for any week after the first', () => {
    expect(canGoPrev(stepWeek(firstWeek, 'next', TIMELINE), TIMELINE)).toBe(true);
  });

  it('disables next exactly at the semester\'s last week', () => {
    expect(canGoNext(lastWeek, TIMELINE)).toBe(false);
  });

  it('enables next for any week before the last', () => {
    expect(canGoNext(stepWeek(lastWeek, 'prev', TIMELINE), TIMELINE)).toBe(true);
  });
});

describe('stepWeek', () => {
  it('steps one week forward', () => {
    expect(stepWeek('2026-09-07', 'next', TIMELINE)).toBe('2026-09-14');
  });

  it('steps one week backward', () => {
    expect(stepWeek('2026-09-14', 'prev', TIMELINE)).toBe('2026-09-07');
  });

  it('does not step past the semester end (clamps, stays at the last week)', () => {
    const lastWeek = mondayOf(TIMELINE.semesterEndDate);
    expect(stepWeek(lastWeek, 'next', TIMELINE)).toBe(lastWeek);
  });

  it('does not step before the semester start (clamps, stays at the first week)', () => {
    const firstWeek = mondayOf(TIMELINE.semesterStartDate);
    expect(stepWeek(firstWeek, 'prev', TIMELINE)).toBe(firstWeek);
  });
});

describe('initialWeekStart', () => {
  it('clamps to the semester bounds regardless of the real current date', () => {
    // "Today" per the harness's system date is well before this fixture's
    // semester start, so the initial week should clamp to the first week —
    // this assertion holds for any real-world "today" outside [start, end].
    const result = initialWeekStart(TIMELINE);
    expect(result >= mondayOf(TIMELINE.semesterStartDate)).toBe(true);
    expect(result <= mondayOf(TIMELINE.semesterEndDate)).toBe(true);
  });
});

describe('formatWeekRangeLabel', () => {
  it('formats a Mon-Sun week range with a single trailing year', () => {
    expect(formatWeekRangeLabel('2026-09-07')).toBe('Sep 7 – Sep 13, 2026');
  });

  it('formats a week that crosses a month boundary', () => {
    expect(formatWeekRangeLabel('2026-11-30')).toBe('Nov 30 – Dec 6, 2026');
  });
});

describe('excludedDaysForWeek', () => {
  it('maps the excluded weekday to its reason for the week containing an exclusion date', () => {
    const result = excludedDaysForWeek('2026-11-23', TIMELINE); // Mon Nov 23 – Sun Nov 29
    expect(result).toEqual(new Map([['Thursday', 'Thanksgiving Break']]));
  });

  it('returns an empty map for a week with no exclusions', () => {
    const result = excludedDaysForWeek('2026-09-07', TIMELINE);
    expect(result.size).toBe(0);
  });

  it('does not depend on local timezone — the exclusion always lands on the correct weekday', () => {
    // Regression guard against local-time getters: Nov 26 2026 must always
    // resolve to Thursday, never Wednesday/Friday due to an off-by-one.
    const result = excludedDaysForWeek('2026-11-23', TIMELINE);
    expect(result.has('Thursday')).toBe(true);
    expect(result.has('Wednesday')).toBe(false);
    expect(result.has('Friday')).toBe(false);
  });
});
