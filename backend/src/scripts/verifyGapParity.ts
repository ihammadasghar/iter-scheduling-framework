// §5.3 empirical extension: cross-checks that the SQLite recursive-CTE
// avg_gap_length computation (relationalGapBenchmark.ts) and the real
// Memgraph Cypher computation (MetricRuleTranslator.ts's
// PROFESSOR_AVG_GAP_LENGTH_CYPHER, via GraphService.evaluateMetrics) agree
// exactly on the same seeded dataset, at each scale — the same rigor as
// relationalComparison.ts's existing conflict-count cross-check, but for a
// value-typed statistic rather than a count.
//
// Usage:
//   pnpm run verify:gap-parity [-- --scales=2000,10000,30000 --seed=42]
//
// Requires a real Memgraph instance (docker-compose up -d memgraph).

import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import neo4j from 'neo4j-driver';
import { MemgraphClient } from '../clients/MemgraphClient.js';
import { GraphService } from '../services/GraphService.js';
import { ensureIndexes } from '../utils/schemaSetup.js';
import { generateDataset } from './generateDataset.js';
import { createGapSchema, loadGapData, orderTimeSlots, computeAvgGapLength } from './relationalGapBenchmark.js';
import type { MetricRule } from '../types/domain.js';

interface CliArgs {
  readonly scales: readonly number[];
  readonly seed: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) flags.set(match[1]!, match[2]!);
  }
  const scalesArg = flags.get('scales') ?? '2000,10000,30000';
  return {
    scales: scalesArg.split(',').map(Number),
    seed: Number(flags.get('seed') ?? 42),
  };
}

const GAP_RULE: readonly MetricRule[] = [
  { id: 'verify-avg-gap', name: 'Avg Gap Length', target: 'Professor', condition: 'avg_gap_length', threshold: 0, weight: 1 },
];

function computeSqliteValue(scale: number, seed: number): number {
  const dataset = generateDataset({ scale, seed });
  const db = new DatabaseSync(':memory:');
  createGapSchema(db);
  loadGapData(
    db,
    orderTimeSlots(dataset.timeSlots),
    dataset.classes.map((c) => ({ id: c.id, professorId: c.professorId, timeSlotId: c.timeSlotIds[0]! })) as never,
  );
  const value = computeAvgGapLength(db);
  db.close();
  return value;
}

async function computeMemgraphValue(graph: GraphService, scale: number, seed: number): Promise<number> {
  const dataset = generateDataset({ scale, seed });
  const branchId = `verify-gap-parity-${scale}-${Date.now()}`;
  try {
    await graph.hydrate(branchId, JSON.stringify(dataset));
    const [result] = await graph.evaluateMetrics(branchId, GAP_RULE);
    return result?.value ?? 0;
  } finally {
    await graph.flush(branchId);
  }
}

async function main(): Promise<void> {
  const { scales, seed } = parseArgs(process.argv.slice(2));

  const uri = process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687';
  const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env['MEMGRAPH_USERNAME'] ?? '', process.env['MEMGRAPH_PASSWORD'] ?? ''),
  );
  const client = new MemgraphClient(driver);
  const graph = new GraphService(client);
  await ensureIndexes(client);

  let allMatch = true;
  try {
    for (const scale of scales) {
      const sqliteValue = computeSqliteValue(scale, seed);
      const memgraphValue = await computeMemgraphValue(graph, scale, seed);
      const matched = sqliteValue === memgraphValue;
      allMatch = allMatch && matched;
      console.log(
        `scale=${scale}: SQLite=${sqliteValue}  Memgraph=${memgraphValue}  ${matched ? 'MATCH' : 'MISMATCH'}`,
      );
    }
  } finally {
    await driver.close();
  }

  if (!allMatch) {
    console.error('\nParity check FAILED: at least one scale disagreed between SQLite and Memgraph.');
    process.exitCode = 1;
  } else {
    console.log('\nParity check passed: SQLite recursive CTE and Memgraph NEXT-chain traversal agree exactly at every scale.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('Gap-parity check failed:', err);
    process.exitCode = 1;
  });
}
