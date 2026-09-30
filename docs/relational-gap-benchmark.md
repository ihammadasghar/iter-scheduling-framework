# Relational gap-length benchmark (RQ1, §5.3 empirical extension)

[`docs/benchmark.md`](./benchmark.md) times `GraphService.queryConflicts()`
against Memgraph and [`relationalComparison.ts`](../backend/src/scripts/relationalComparison.ts)
times the same double-booking checks against SQLite — but neither measures
the other structural argument the thesis's §5.3.1 makes for the graph model:
that `Professor:avg_gap_length` (the chronological `:NEXT`-chain traversal,
`MetricRuleTranslator.ts`'s `PROFESSOR_AVG_GAP_LENGTH_CYPHER`) has "no clean
relational equivalent," only analytically argued there, not measured. This
document describes the scripts that measure it directly instead of leaving
that claim untested.

## What it measures

Three scripts, all reusing the same seeded `generateDataset.ts` output as
`benchmark.ts` and `relationalComparison.ts`:

1. **`relationalGapBenchmark.ts`** — expresses the traversal the way a
   relational engine actually would: a SQLite `WITH RECURSIVE` CTE walking a
   `time_slots` table ordered by `(day_order, period_order)`, bounded to 8
   hops (the same bound as the Cypher's `*1..8`), never crossing a day
   boundary. Times `load` (schema + bulk insert) and `query` (the CTE plus
   the per-professor-then-across-professor averaging) separately, same
   convention as `relationalComparison.ts`.
2. **`benchmarkGapMetric.ts`** — times *just* this one metric's Cypher query
   against a real Memgraph instance, via
   `GraphService.evaluateMetrics(branchId, [avgGapLengthRule])` — isolated
   from `benchmark.ts`'s `scoreTimetable()`, which bundles several sample
   metrics into one timed call and so can't be used as a fair, single-metric
   comparison point.
3. **`verifyGapParity.ts`** — runs both computations over the *same* seeded
   dataset at each scale and asserts the two engines agree exactly on the
   computed `avg_gap_length` value — the same rigor as
   `relationalComparison.ts`'s existing conflict-count cross-check, applied
   to a value-typed statistic rather than a count.

`relationalGapBenchmark.ts` exports a pure `computeAvgGapLength(db)` function,
unit-tested independently of timing or Memgraph in
`relationalGapBenchmark.test.ts` (day-boundary behaviour, the 8-hop bound,
and the per-professor-then-across-professor averaging that keeps a
heavily-scheduled professor from dominating the figure).

## Running it

```bash
# From the repo root
docker-compose up -d memgraph

cd backend
pnpm run compare:relational:gap -- --scale=30000 --seed=42   # SQLite side, no Memgraph needed
pnpm run benchmark:gap -- --scale=30000 --seed=42             # Memgraph side
pnpm run verify:gap-parity -- --scales=2000,10000,30000 --seed=42
```

### Flags

| Flag       | Default            | Meaning                                                    |
|------------|---------------------|-------------------------------------------------------------|
| `--scale`  | `30000`             | Number of classes (`relationalGapBenchmark.ts`/`benchmarkGapMetric.ts`). |
| `--scales` | `2000,10000,30000`  | Comma-separated scales to check (`verifyGapParity.ts` only). |
| `--seed`   | `42`                | PRNG seed — same as `benchmark.ts`/`relationalComparison.ts`. |

## Interpreting the output

Each of the two benchmark scripts writes a JSON result
(`backend/relational-gap-benchmark-results/` and `backend/benchmark-gap-results/`
respectively, both gitignored) containing `timingsMs` and the computed
`avgGapLength`. `verifyGapParity.ts` prints a per-scale MATCH/MISMATCH line
and exits non-zero on any mismatch — it does not write a result file, since
its output is the pass/fail check itself, not a citable timing number.

## What this does *not* cover

Same scope boundary as `relationalComparison.ts`'s own limitations section
(thesis §5.3.3): a single cold load-then-query pass, not a concurrently
written, long-running relational server.

### Numbers filled in

Run on the same development machine and seed as `docs/benchmark.md`'s table
(Intel Core i5-1135G7, 8 logical cores @ 2.40GHz, WSL2), 2026-09-30, median of
3 runs per scale:

| Scale | SQLite load | SQLite query (recursive CTE) | Memgraph hydration | Memgraph `avg_gap_length` (Cypher) | `avg_gap_length` value |
|---|---|---|---|---|---|
| 2,000 | 9.75 ms | 14.36 ms | 706.88 ms | 50.16 ms | 1.11 |
| 10,000 | 25.63 ms | 76.90 ms | 1,253.80 ms | 259.00 ms | 1.21 |
| 30,000 | 61.50 ms | 325.16 ms | 2,579.56 ms | 873.20 ms | 1.19 |

Parity check (`verify:gap-parity`) result: **passed at every scale** —
SQLite's recursive CTE and Memgraph's Cypher traversal computed the
identical `avg_gap_length` value (1.11 / 1.21 / 1.19) on the same seeded
dataset at 2,000 / 10,000 / 30,000 classes.

SQLite's recursive CTE is faster than the isolated Memgraph Cypher query at
every scale measured here too (as with the double-booking checks in
`relationalComparison.ts`) — consistent with the thesis's own reading of
that result (§5.3.2): the graph model's case for this traversal is that it
requires no schema-specific, hand-written recursion or fixed-depth
self-join unrolling to express, not that it is faster in isolation.
