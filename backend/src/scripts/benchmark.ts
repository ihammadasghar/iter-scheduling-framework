// G1 performance benchmark: hydrates a synthetic, institution-scale dataset
// into a real (non-mocked) Memgraph instance and times conflict detection
// and weighted scoring against it — the evaluation criterion RQ1/G1
// explicitly requires ("evaluated for... query-response time against a
// synthetic, institution-scale dataset") and that, before this script,
// existed nowhere in the repo. See docs/benchmark.md for how to run this.
//
// Usage:
//   pnpm run benchmark [-- --scale=30000 --seed=42]
//
// Requires a real Memgraph instance reachable via the same MEMGRAPH_URI /
// MEMGRAPH_USERNAME / MEMGRAPH_PASSWORD env vars container.ts uses (default:
// bolt://localhost:7687, no auth) — e.g. `docker-compose up -d memgraph`.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import neo4j from 'neo4j-driver';
import { MemgraphClient } from '../clients/MemgraphClient.js';
import { GraphService } from '../services/GraphService.js';
import { generateDataset } from './generateDataset.js';
import type { MetricRule } from '../types/domain.js';

const DEFAULT_SCALE = 30_000; // matches the unverified estimate in docs/system-architecture.md

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
    scale: Number(flags.get('scale') ?? DEFAULT_SCALE),
    seed: Number(flags.get('seed') ?? 42),
  };
}

// A handful of representative metric rules — a fresh benchmark branch has no
// institution-authored rules.json to read, so these stand in for it.
const SAMPLE_RULES: readonly MetricRule[] = [
  { id: 'bench-class-count', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0, weight: 1 },
  { id: 'bench-avg-day', name: 'Avg Classes/Day', target: 'Professor', condition: 'avg_classes_per_day', threshold: 3, weight: 1 },
  { id: 'bench-room-util', name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 70, weight: 1 },
];

interface BenchmarkResult {
  readonly scale: number;
  readonly seed: number;
  readonly counts: {
    readonly classes: number;
    readonly rooms: number;
    readonly professors: number;
    readonly studentGroups: number;
    readonly courses: number;
    readonly timeSlots: number;
  };
  readonly timingsMs: {
    readonly hydration: number;
    readonly queryConflicts: number;
    readonly scoreTimetable: number;
    readonly total: number;
  };
  readonly conflictCount: number;
  readonly score: number;
  readonly ranAt: string;
}

const round2 = (ms: number): number => Math.round(ms * 100) / 100;

async function main(): Promise<void> {
  const { scale, seed } = parseArgs(process.argv.slice(2));
  const branchId = `benchmark-${Date.now()}`;

  console.log(`Generating synthetic dataset: scale=${scale} classes, seed=${seed}...`);
  const dataset = generateDataset({ scale, seed });
  console.log(
    `Generated ${dataset.classes.length} classes, ${dataset.rooms.length} rooms, ` +
    `${dataset.professors.length} professors, ${dataset.studentGroups.length} groups, ` +
    `${dataset.courses.length} courses, ${dataset.timeSlots.length} time slots.`,
  );

  const uri = process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687';
  const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env['MEMGRAPH_USERNAME'] ?? '', process.env['MEMGRAPH_PASSWORD'] ?? ''),
  );
  const graph = new GraphService(new MemgraphClient(driver));

  let conflictCount = 0;
  let score = 0;
  let hydrationMs = 0;
  let conflictsMs = 0;
  let scoreMs = 0;

  console.log(`Connecting to Memgraph at ${uri}, hydrating branch '${branchId}'...`);
  const totalStart = performance.now();
  try {
    const hydrateStart = performance.now();
    await graph.hydrate(branchId, JSON.stringify(dataset));
    hydrationMs = performance.now() - hydrateStart;

    const conflictsStart = performance.now();
    const conflicts = await graph.queryConflicts(branchId);
    conflictsMs = performance.now() - conflictsStart;
    conflictCount = conflicts.length;

    const scoreStart = performance.now();
    const scoreResult = await graph.scoreTimetable(branchId, SAMPLE_RULES);
    scoreMs = performance.now() - scoreStart;
    score = scoreResult.score;
  } finally {
    // Always clean up the scratch branch, same as every other ephemeral
    // branch use in the codebase (CiPipelineService, ProposalService, etc.).
    await graph.flush(branchId);
    await driver.close();
  }
  const totalMs = performance.now() - totalStart;

  const result: BenchmarkResult = {
    scale,
    seed,
    counts: {
      classes: dataset.classes.length,
      rooms: dataset.rooms.length,
      professors: dataset.professors.length,
      studentGroups: dataset.studentGroups.length,
      courses: dataset.courses.length,
      timeSlots: dataset.timeSlots.length,
    },
    timingsMs: {
      hydration: round2(hydrationMs),
      queryConflicts: round2(conflictsMs),
      scoreTimetable: round2(scoreMs),
      total: round2(totalMs),
    },
    conflictCount,
    score,
    ranAt: new Date().toISOString(),
  };

  console.log('\nBenchmark results:');
  console.table(result.timingsMs);
  console.log(`Conflicts found: ${result.conflictCount}`);
  console.log(`Weighted score: ${result.score}/100`);

  // Resolved relative to the current working directory (this script is run
  // via `pnpm run benchmark` from `backend/`, per docs/benchmark.md).
  const outDir = join(process.cwd(), 'benchmark-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${Date.now()}-scale${scale}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nFull results written to ${outFile}`);
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exitCode = 1;
});
