// §5.2 (Chapter 5, "Comparison with Traditional Relational Databases") empirical
// half: times the SQL-equivalent of GraphService.queryConflicts()'s three
// pairwise double-booking self-joins (ROOM_DOUBLE_BOOK, PROFESSOR_OVERLAP,
// GROUP_OVERLAP — see GraphService.ts) against the *same* generateDataset()
// output already used for the G1 Memgraph benchmark (benchmark.ts), loaded
// into an indexed SQLite database instead of Memgraph. Deliberately scoped to
// this one operation, not a feature-parity relational backend — see the
// thesis's §5.2 scope statement.
//
// Uses node:sqlite (stable in this project's Node >=20 target on recent
// Node releases) rather than adding a new npm dependency for a single,
// bounded comparison script.
//
// Usage:
//   pnpm run compare:relational [-- --scale=30000 --seed=42]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { generateDataset } from './generateDataset.js';

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

interface ComparisonResult {
  readonly scale: number;
  readonly seed: number;
  readonly counts: {
    readonly classes: number;
    readonly rooms: number;
    readonly professors: number;
    readonly studentGroups: number;
  };
  readonly timingsMs: {
    readonly load: number; // schema create + row insert + index build — the
    // relational analogue of Memgraph's hydration cost
    readonly query: number; // the three double-booking self-joins, timed together
  };
  readonly conflictCount: number;
  readonly ranAt: string;
}

const round2 = (ms: number): number => Math.round(ms * 100) / 100;

function runOnce(scale: number, seed: number): ComparisonResult {
  console.log(`Generating synthetic dataset: scale=${scale} classes, seed=${seed}...`);
  const dataset = generateDataset({ scale, seed });
  console.log(
    `Generated ${dataset.classes.length} classes, ${dataset.rooms.length} rooms, ` +
    `${dataset.professors.length} professors, ${dataset.studentGroups.length} groups.`,
  );

  const db = new DatabaseSync(':memory:');
  const totalStart = performance.now();

  // Schema mirrors the graph model's flat foreign-key shape (Chapter 3
  // §sec:schema) as a normalized relational table would require it: one
  // `classes` row per class, with FK columns instead of graph edges.
  // Indexed on exactly the (resource, time_slot) column pairs the three
  // conflict queries below filter on — the fairest relational analogue of
  // Memgraph's own steady-state indexed state (schemaSetup.ts), not an
  // artificially unindexed worst case.
  db.exec(`
    CREATE TABLE rooms (id TEXT PRIMARY KEY, capacity INTEGER NOT NULL);
    CREATE TABLE professors (id TEXT PRIMARY KEY);
    CREATE TABLE student_groups (id TEXT PRIMARY KEY, size INTEGER NOT NULL);
    CREATE TABLE time_slots (id TEXT PRIMARY KEY);
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      professor_id TEXT NOT NULL,
      student_group_id TEXT NOT NULL,
      time_slot_id TEXT NOT NULL
    );
    CREATE INDEX idx_classes_room_slot ON classes(room_id, time_slot_id);
    CREATE INDEX idx_classes_prof_slot ON classes(professor_id, time_slot_id);
    CREATE INDEX idx_classes_group_slot ON classes(student_group_id, time_slot_id);
    CREATE INDEX idx_classes_group ON classes(student_group_id);
    CREATE INDEX idx_classes_room ON classes(room_id);
  `);

  const insertRoom = db.prepare('INSERT INTO rooms (id, capacity) VALUES (?, ?)');
  const insertProf = db.prepare('INSERT INTO professors (id) VALUES (?)');
  const insertGroup = db.prepare('INSERT INTO student_groups (id, size) VALUES (?, ?)');
  const insertSlot = db.prepare('INSERT INTO time_slots (id) VALUES (?)');
  const insertClass = db.prepare(
    'INSERT INTO classes (id, room_id, professor_id, student_group_id, time_slot_id) VALUES (?, ?, ?, ?, ?)',
  );

  db.exec('BEGIN');
  for (const r of dataset.rooms) insertRoom.run(r.id, r.capacity);
  for (const p of dataset.professors) insertProf.run(p.id);
  for (const g of dataset.studentGroups) insertGroup.run(g.id, g.size);
  for (const t of dataset.timeSlots) insertSlot.run(t.id);
  // generateDataset() always assigns exactly one time slot per class
  // (timeSlotIds[0]) — see generateDataset.ts's buildClasses — so a single
  // scalar column faithfully represents this dataset without loss.
  for (const c of dataset.classes) insertClass.run(c.id, c.roomId, c.professorId, c.studentGroupId, c.timeSlotIds[0]!);
  db.exec('COMMIT');

  const loadMs = performance.now() - totalStart;

  // Direct SQL equivalents of GraphService.queryConflicts()'s three
  // pairwise self-joins: two distinct classes sharing a resource (room /
  // professor / student group) AND the same time slot. c1.id < c2.id
  // avoids counting each pair twice, exactly like the Cypher's WHERE clause.
  const queryStart = performance.now();
  const roomConflicts = db.prepare(`
    SELECT c1.id AS class1, c2.id AS class2
    FROM classes c1 JOIN classes c2
      ON c1.room_id = c2.room_id AND c1.time_slot_id = c2.time_slot_id AND c1.id < c2.id
  `).all();
  const profConflicts = db.prepare(`
    SELECT c1.id AS class1, c2.id AS class2
    FROM classes c1 JOIN classes c2
      ON c1.professor_id = c2.professor_id AND c1.time_slot_id = c2.time_slot_id AND c1.id < c2.id
  `).all();
  const groupConflicts = db.prepare(`
    SELECT c1.id AS class1, c2.id AS class2
    FROM classes c1 JOIN classes c2
      ON c1.student_group_id = c2.student_group_id AND c1.time_slot_id = c2.time_slot_id AND c1.id < c2.id
  `).all();
  // Fourth check, matching GraphService.queryConflicts()'s ROOM_CAPACITY_EXCEEDED:
  // a single-row predicate, no join complexity — included so the total conflict
  // count is directly comparable to the Memgraph benchmark's, not because it
  // bears on the relational-vs-graph question this comparison targets.
  const capacityConflicts = db.prepare(`
    SELECT c.id AS classId
    FROM classes c
    JOIN rooms r ON r.id = c.room_id
    JOIN student_groups g ON g.id = c.student_group_id
    WHERE g.size > r.capacity
  `).all();
  const queryMs = performance.now() - queryStart;

  const conflictCount =
    roomConflicts.length + profConflicts.length + groupConflicts.length + capacityConflicts.length;

  db.close();

  return {
    scale,
    seed,
    counts: {
      classes: dataset.classes.length,
      rooms: dataset.rooms.length,
      professors: dataset.professors.length,
      studentGroups: dataset.studentGroups.length,
    },
    timingsMs: { load: round2(loadMs), query: round2(queryMs) },
    conflictCount,
    ranAt: new Date().toISOString(),
  };
}

function main(): void {
  const { scale, seed } = parseArgs(process.argv.slice(2));
  const result = runOnce(scale, seed);

  console.log('\nRelational-comparison results:');
  console.table(result.timingsMs);
  console.log(`Conflicts found (room + professor + group double-booking): ${result.conflictCount}`);

  const outDir = join(process.cwd(), 'relational-comparison-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${Date.now()}-scale${scale}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nFull results written to ${outFile}`);
}

main();
