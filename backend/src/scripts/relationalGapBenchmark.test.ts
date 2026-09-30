import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  createGapSchema,
  loadGapData,
  computeAvgGapLength,
  orderTimeSlots,
} from './relationalGapBenchmark.js';
import type { RawTimeSlot } from '../types/scheduleJson.js';

// Small, hand-built fixtures rather than generateDataset() — these tests
// verify the recursive CTE's logic (day-boundary behaviour, the 8-hop
// bound, per-professor-then-across-professor averaging), independent of
// the seeded generator's own shape. Mirrors
// MetricRuleTranslator.ts's PROFESSOR_AVG_GAP_LENGTH_CYPHER directly.

interface ClassRow {
  readonly id: string;
  readonly professorId: string;
  readonly timeSlotId: string;
}

function slot(day: string, period: number): RawTimeSlot {
  return {
    id: `TS_${day.slice(0, 3).toUpperCase()}_P${period}`,
    day,
    name: `Period ${period}`,
    startTime: `${String(7 + period).padStart(2, '0')}:00`,
    endTime: `${String(8 + period).padStart(2, '0')}:00`,
  };
}

function buildDb(timeSlots: readonly RawTimeSlot[], classes: readonly ClassRow[]): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  createGapSchema(db);
  loadGapData(db, orderTimeSlots(timeSlots), classes as never);
  return db;
}

describe('computeAvgGapLength()', () => {
  it('returns 0 when no professor has two same-day classes', () => {
    const timeSlots = [slot('Monday', 1), slot('Monday', 2)];
    const classes: ClassRow[] = [
      { id: 'C1', professorId: 'P1', timeSlotId: timeSlots[0]!.id },
    ];
    const db = buildDb(timeSlots, classes);
    expect(computeAvgGapLength(db)).toBe(0);
  });

  it('computes hops-1 for two back-to-back classes as 0', () => {
    const timeSlots = [slot('Monday', 1), slot('Monday', 2)];
    const classes: ClassRow[] = [
      { id: 'C1', professorId: 'P1', timeSlotId: timeSlots[0]!.id },
      { id: 'C2', professorId: 'P1', timeSlotId: timeSlots[1]!.id },
    ];
    const db = buildDb(timeSlots, classes);
    // Only C1 has a "next" class (C2); C2 has none after it. avgGapPerProf
    // over the single qualifying row = 0, overall avg across professors = 0.
    expect(computeAvgGapLength(db)).toBe(0);
  });

  it('computes hops-1 correctly for classes separated by N idle slots', () => {
    const timeSlots = [1, 2, 3, 4].map((p) => slot('Monday', p));
    const classes: ClassRow[] = [
      { id: 'C1', professorId: 'P1', timeSlotId: timeSlots[0]!.id }, // P1
      { id: 'C2', professorId: 'P1', timeSlotId: timeSlots[3]!.id }, // P4: 3 hops away, gap = 2
    ];
    const db = buildDb(timeSlots, classes);
    expect(computeAvgGapLength(db)).toBe(2);
  });

  it('never walks across a day boundary (mirrors :NEXT never crossing days)', () => {
    const timeSlots = [slot('Monday', 8), slot('Tuesday', 1)];
    const classes: ClassRow[] = [
      { id: 'C1', professorId: 'P1', timeSlotId: timeSlots[0]!.id }, // Monday, last period
      { id: 'C2', professorId: 'P1', timeSlotId: timeSlots[1]!.id }, // Tuesday, first period
    ];
    const db = buildDb(timeSlots, classes);
    // Adjacent in period_order terms within their own day, but on different
    // days — no NEXT-chain equivalent connects them, so no match is found
    // and the metric falls back to 0, same as the "no data" case.
    expect(computeAvgGapLength(db)).toBe(0);
  });

  it('respects the 8-hop bound, matching the Cypher *1..8', () => {
    // A synthetic 10-period day, used only to exercise the bound itself —
    // real datasets never exceed 8 periods/day (generateDataset.ts), so
    // this case cannot arise from generateDataset() output, only here.
    const tenPeriodDay = Array.from({ length: 10 }, (_, i) => slot('Monday', i + 1));

    const withinBound = buildDb(tenPeriodDay, [
      { id: 'C1', professorId: 'P1', timeSlotId: tenPeriodDay[0]!.id }, // period_order 0
      { id: 'C2', professorId: 'P1', timeSlotId: tenPeriodDay[8]!.id }, // period_order 8, exactly 8 hops away
    ]);
    expect(computeAvgGapLength(withinBound)).toBe(7);

    const beyondBound = buildDb(tenPeriodDay, [
      { id: 'C1', professorId: 'P1', timeSlotId: tenPeriodDay[0]!.id }, // period_order 0
      { id: 'C2', professorId: 'P1', timeSlotId: tenPeriodDay[9]!.id }, // period_order 9, 9 hops away
    ]);
    expect(computeAvgGapLength(beyondBound)).toBe(0);
  });

  it('averages per-professor first, then across professors (a heavy professor does not dominate)', () => {
    const timeSlots = Array.from({ length: 8 }, (_, i) => slot('Monday', i + 1));
    const classes: ClassRow[] = [
      // Professor A: P1, P2, P3 — two back-to-back qualifying gaps (0, 0) -> avg 0
      { id: 'A1', professorId: 'PA', timeSlotId: timeSlots[0]!.id },
      { id: 'A2', professorId: 'PA', timeSlotId: timeSlots[1]!.id },
      { id: 'A3', professorId: 'PA', timeSlotId: timeSlots[2]!.id },
      // Professor B: P1, P7 — one qualifying gap of 5 (hops=6) -> avg 5
      { id: 'B1', professorId: 'PB', timeSlotId: timeSlots[0]!.id },
      { id: 'B2', professorId: 'PB', timeSlotId: timeSlots[6]!.id },
    ];
    const db = buildDb(timeSlots, classes);
    // Per-professor-then-across-professor average: mean(0, 5) = 2.5.
    // A naive, class-weighted average over all three qualifying rows
    // (0, 0, 5) would instead give 1.67 — this test fails against that
    // wrong implementation.
    expect(computeAvgGapLength(db)).toBe(2.5);
  });

  it('matches a hand-computed expected value on a small fixed synthetic dataset', () => {
    const timeSlots = [
      ...Array.from({ length: 8 }, (_, i) => slot('Monday', i + 1)),
      ...Array.from({ length: 8 }, (_, i) => slot('Tuesday', i + 1)),
    ];
    const mon = timeSlots.slice(0, 8);
    const tue = timeSlots.slice(8);
    const classes: ClassRow[] = [
      // Professor A, Monday: P2 and P5 -> hops=3, gap=2
      { id: 'A1', professorId: 'PA', timeSlotId: mon[1]!.id },
      { id: 'A2', professorId: 'PA', timeSlotId: mon[4]!.id },
      // Professor A, Tuesday: P1 and P2 -> hops=1, gap=0 (same professor,
      // different day -> a second, independent qualifying row for PA)
      { id: 'A3', professorId: 'PA', timeSlotId: tue[0]!.id },
      { id: 'A4', professorId: 'PA', timeSlotId: tue[1]!.id },
    ];
    const db = buildDb(timeSlots, classes);
    // PA's qualifying rows: gap=2 (A1->A2), gap=0 (A3->A4) -> avgGapPerProf = 1.0
    // Only one professor -> overall = 1.0.
    expect(computeAvgGapLength(db)).toBe(1);
  });
});
