// §5.3 empirical extension: times *just* the Professor:avg_gap_length
// metric (the NEXT-chain traversal) against a real Memgraph instance, in
// isolation from the other sample metrics benchmark.ts's `scoreTimetable`
// bundles together — so it can be compared apples-to-apples against
// relationalGapBenchmark.ts's isolated SQLite recursive-CTE timing.
//
// Usage:
//   pnpm run benchmark:gap [-- --scale=30000 --seed=42]
//
// Requires a real Memgraph instance reachable via the same MEMGRAPH_URI /
// MEMGRAPH_USERNAME / MEMGRAPH_PASSWORD env vars benchmark.ts uses (default:
// bolt://localhost:7687, no auth) — e.g. `docker-compose up -d memgraph`.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import neo4j from 'neo4j-driver';
import { MemgraphClient } from '../clients/MemgraphClient.js';
import { GraphService } from '../services/GraphService.js';
import { ensureIndexes } from '../utils/schemaSetup.js';
import { generateDataset } from './generateDataset.js';
import type { MetricRule } from '../types/domain.js';

const DEFAULT_SCALE = 30_000;

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

// A single rule, run alone: evaluateMetrics([rule]) issues exactly one
// translateRule -> client.run round trip for this metric, unlike
// benchmark.ts's scoreTimetable(SAMPLE_RULES), which bundles several
// metrics' Cypher calls into one timed block.
const GAP_RULE: readonly MetricRule[] = [
  { id: 'bench-avg-gap', name: 'Avg Gap Length', target: 'Professor', condition: 'avg_gap_length', threshold: 0, weight: 1 },
];

interface GapMetricBenchmarkResult {
  readonly scale: number;
  readonly seed: number;
  readonly counts: {
    readonly classes: number;
    readonly professors: number;
    readonly timeSlots: number;
  };
  readonly timingsMs: {
    readonly hydration: number;
    readonly avgGapLength: number;
  };
  readonly avgGapLength: number;
  readonly ranAt: string;
}

const round2 = (ms: number): number => Math.round(ms * 100) / 100;

async function main(): Promise<void> {
  const { scale, seed } = parseArgs(process.argv.slice(2));
  const branchId = `benchmark-gap-${Date.now()}`;

  console.log(`Generating synthetic dataset: scale=${scale} classes, seed=${seed}...`);
  const dataset = generateDataset({ scale, seed });

  const uri = process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687';
  const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env['MEMGRAPH_USERNAME'] ?? '', process.env['MEMGRAPH_PASSWORD'] ?? ''),
  );
  const client = new MemgraphClient(driver);
  const graph = new GraphService(client);

  console.log('Ensuring Memgraph indexes exist...');
  await ensureIndexes(client);

  let hydrationMs = 0;
  let gapMs = 0;
  let avgGapLength = 0;

  console.log(`Connecting to Memgraph at ${uri}, hydrating branch '${branchId}'...`);
  try {
    const hydrateStart = performance.now();
    await graph.hydrate(branchId, JSON.stringify(dataset));
    hydrationMs = performance.now() - hydrateStart;

    const gapStart = performance.now();
    const [gapResult] = await graph.evaluateMetrics(branchId, GAP_RULE);
    gapMs = performance.now() - gapStart;
    avgGapLength = gapResult?.value ?? 0;
  } finally {
    await graph.flush(branchId);
    await driver.close();
  }

  const result: GapMetricBenchmarkResult = {
    scale,
    seed,
    counts: {
      classes: dataset.classes.length,
      professors: dataset.professors.length,
      timeSlots: dataset.timeSlots.length,
    },
    timingsMs: { hydration: round2(hydrationMs), avgGapLength: round2(gapMs) },
    avgGapLength,
    ranAt: new Date().toISOString(),
  };

  console.log('\nMemgraph avg_gap_length (isolated) benchmark results:');
  console.table(result.timingsMs);
  console.log(`avg_gap_length (Cypher, NEXT-chain): ${result.avgGapLength} slots`);

  const outDir = join(process.cwd(), 'benchmark-gap-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${Date.now()}-scale${scale}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nFull results written to ${outFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('Gap-metric benchmark failed:', err);
    process.exitCode = 1;
  });
}
