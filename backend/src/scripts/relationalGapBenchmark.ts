// §5.3 empirical extension: times the SQL-equivalent of the
// Professor:avg_gap_length metric (MetricRuleTranslator.ts's
// PROFESSOR_AVG_GAP_LENGTH_CYPHER) against the *same* generateDataset()
// output already used for the G1 Memgraph benchmark and the double-booking
// comparison (relationalComparison.ts), loaded into an indexed SQLite
// database instead of Memgraph.
//
// This is the traversal relationalComparison.ts's own §5.3.3 scope
// statement names as "not implemented or measured" there — the NEXT-chain,
// variable-length walk the thesis's analytical argument (§5.3.1) says has
// no clean relational equivalent. Rather than leave that claim untested,
// this script expresses it the way a relational engine actually would:
// `WITH RECURSIVE` walking a `time_slots` table ordered by (day, period),
// bounded to 8 hops — the same bound as the Cypher's `*1..8` — since :NEXT
// edges never cross a day (ScheduleHydrator.buildChronologicalPairs).
//
// Usage:
//   pnpm run compare:relational:gap [-- --scale=30000 --seed=42]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { generateDataset } from './generateDataset.js';
import type { RawClass, RawTimeSlot } from '../types/scheduleJson.js';

interface CliArgs {
  readonly scale: number;
  readonly seed: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) flags.set(match[1]!, match[2]!);
  }
  return {
    scale: Number(flags.get('scale') ?? 30_000),
    seed: Number(flags.get('seed') ?? 42),
  };
}

// Duplicated from ScheduleHydrator.ts's private DAY_ORDER rather than
// imported: this script stays dependency-free from the Cypher/graph-side
// internals (same spirit as relationalComparison.ts not importing
// GraphService), and the two lists only need to agree on ordinal day order,
// not stay wired together at the type level.
const DAY_ORDER: readonly string[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export const round2 = (ms: number): number => Math.round(ms * 100) / 100;

export interface OrderedTimeSlot {
  readonly id: string;
  readonly dayOrder: number;
  readonly periodOrder: number;
}

// Reproduces ScheduleHydrator.buildChronologicalPairs's own ordering
// exactly (sort by day, then by startTime within the day) so the relational
// table's (day_order, period_order) pair encodes precisely the chain the
// :NEXT edges encode — periodOrder is a 0-based rank within the day, not the
// slot's own `period` number, so it stays valid even if a day ever had a
// non-contiguous period sequence.
export function orderTimeSlots(timeSlots: readonly RawTimeSlot[]): readonly OrderedTimeSlot[] {
  const byDay = new Map<string, RawTimeSlot[]>();
  for (const slot of timeSlots) {
    const existing = byDay.get(slot.day) ?? [];
    existing.push(slot);
    byDay.set(slot.day, existing);
  }

  const ordered: OrderedTimeSlot[] = [];
  for (const [day, slots] of byDay) {
    const dayOrder = DAY_ORDER.indexOf(day);
    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    sorted.forEach((slot, periodOrder) => {
      ordered.push({ id: slot.id, dayOrder, periodOrder });
    });
  }
  return ordered;
}

// Same 8-hop bound as the Cypher's `*1..8` (PROFESSOR_AVG_GAP_LENGTH_CYPHER).
const MAX_HOPS = 8;

export function createGapSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE time_slots (
      id TEXT PRIMARY KEY,
      day_order INTEGER NOT NULL,
      period_order INTEGER NOT NULL
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      professor_id TEXT NOT NULL,
      time_slot_id TEXT NOT NULL
    );
    CREATE INDEX idx_ts_day_period ON time_slots(day_order, period_order);
    CREATE INDEX idx_classes_prof_slot ON classes(professor_id, time_slot_id);
  `);
}

export function loadGapData(
  db: DatabaseSync,
  timeSlots: readonly OrderedTimeSlot[],
  classes: readonly Pick<RawClass, 'id' | 'professorId'>[] & { timeSlotId: string }[],
): void {
  const insertSlot = db.prepare('INSERT INTO time_slots (id, day_order, period_order) VALUES (?, ?, ?)');
  const insertClass = db.prepare('INSERT INTO classes (id, professor_id, time_slot_id) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  for (const t of timeSlots) insertSlot.run(t.id, t.dayOrder, t.periodOrder);
  for (const c of classes) insertClass.run(c.id, c.professorId, c.timeSlotId);
  db.exec('COMMIT');
}

interface GapWalkRow {
  readonly classId: string;
  readonly professorId: string;
  readonly minHops: number;
}

// Pure computation over an already-loaded db — kept separate from
// load/timing concerns so it's independently unit-testable
// (relationalGapBenchmark.test.ts) and reusable by verifyGapParity.ts.
// Mirrors PROFESSOR_AVG_GAP_LENGTH_CYPHER's two-stage averaging exactly:
// hops-1 per class, averaged per professor, then averaged across
// professors, so a professor with many classes doesn't dominate — and the
// same 0.0 fallback when no professor has two same-day classes within
// MAX_HOPS.
export function computeAvgGapLength(db: DatabaseSync): number {
  const rows = db.prepare(`
    WITH RECURSIVE gap_walk(class_id, professor_id, day_order, start_period, hops, ts_id) AS (
      SELECT cl.id, cl.professor_id, ts.day_order, ts.period_order, 0, ts.id
      FROM classes cl JOIN time_slots ts ON ts.id = cl.time_slot_id

      UNION ALL

      SELECT gw.class_id, gw.professor_id, gw.day_order, gw.start_period, gw.hops + 1, ts2.id
      FROM gap_walk gw
      JOIN time_slots ts2
        ON ts2.day_order = gw.day_order
       AND ts2.period_order = gw.start_period + gw.hops + 1
      WHERE gw.hops < ${MAX_HOPS}
    )
    SELECT gw.class_id AS classId, gw.professor_id AS professorId, MIN(gw.hops) AS minHops
    FROM gap_walk gw
    JOIN classes c2
      ON c2.time_slot_id = gw.ts_id
     AND c2.professor_id = gw.professor_id
     AND c2.id <> gw.class_id
    WHERE gw.hops >= 1
    GROUP BY gw.class_id, gw.professor_id
  `).all() as unknown as readonly GapWalkRow[];

  if (rows.length === 0) return 0.0;

  const gapsByProfessor = new Map<string, number[]>();
  for (const row of rows) {
    const gaps = gapsByProfessor.get(row.professorId) ?? [];
    gaps.push(row.minHops - 1);
    gapsByProfessor.set(row.professorId, gaps);
  }

  const perProfessorAverages = [...gapsByProfessor.values()].map(
    (gaps) => gaps.reduce((sum, g) => sum + g, 0) / gaps.length,
  );
  const overallAvgGap =
    perProfessorAverages.reduce((sum, avg) => sum + avg, 0) / perProfessorAverages.length;

  return round2(overallAvgGap);
}

export interface GapBenchmarkResult {
  readonly scale: number;
  readonly seed: number;
  readonly counts: {
    readonly classes: number;
    readonly professors: number;
    readonly timeSlots: number;
  };
  readonly timingsMs: {
    readonly load: number;
    readonly query: number;
  };
  readonly avgGapLength: number;
  readonly ranAt: string;
}

export function runOnce(scale: number, seed: number): GapBenchmarkResult {
  console.log(`Generating synthetic dataset: scale=${scale} classes, seed=${seed}...`);
  const dataset = generateDataset({ scale, seed });

  const db = new DatabaseSync(':memory:');
  const loadStart = performance.now();
  createGapSchema(db);
  const orderedSlots = orderTimeSlots(dataset.timeSlots);
  // generateDataset() always assigns exactly one time slot per class
  // (timeSlotIds[0]) — see generateDataset.ts's buildClasses.
  const classRows = dataset.classes.map((c) => ({
    id: c.id,
    professorId: c.professorId,
    timeSlotId: c.timeSlotIds[0]!,
  }));
  loadGapData(db, orderedSlots, classRows as never);
  const loadMs = performance.now() - loadStart;

  const queryStart = performance.now();
  const avgGapLength = computeAvgGapLength(db);
  const queryMs = performance.now() - queryStart;

  db.close();

  return {
    scale,
    seed,
    counts: {
      classes: dataset.classes.length,
      professors: dataset.professors.length,
      timeSlots: dataset.timeSlots.length,
    },
    timingsMs: { load: round2(loadMs), query: round2(queryMs) },
    avgGapLength,
    ranAt: new Date().toISOString(),
  };
}

function main(): void {
  const { scale, seed } = parseArgs(process.argv.slice(2));
  const result = runOnce(scale, seed);

  console.log('\nRelational gap-length benchmark results:');
  console.table(result.timingsMs);
  console.log(`avg_gap_length (SQLite recursive CTE): ${result.avgGapLength} slots`);

  const outDir = join(process.cwd(), 'relational-gap-benchmark-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${Date.now()}-scale${scale}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nFull results written to ${outFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
