# Performance benchmark (RQ1 / Goal G1)

RQ1 asks whether graph-based conflict detection can "remain fast enough for
real-time use at institutional scale," and Goal G1 requires this to be
**"evaluated for... query-response time against a synthetic, institution-scale
dataset."** This document describes the reproducible benchmark that provides
that evaluation.

Before this script existed, the only number in the codebase resembling a
performance measurement was an *estimate* in
[`docs/system-architecture.md`](./system-architecture.md) — "10–20 seconds to
load a 30,000-class schedule into memory" — explicitly not a measurement.
Running this benchmark either confirms that estimate or replaces it with a
real one.

## What it measures

`backend/src/scripts/benchmark.ts`:

1. Generates a synthetic dataset via `generateDataset.ts` (a seeded, pure
   generator — same `scale`/`seed` always produces the same dataset; see its
   own tests for details).
2. Hydrates it into a real Memgraph instance on a scratch branch
   (`benchmark-<timestamp>`), timing the hydration.
3. Times `GraphService.queryConflicts()` — the same query path used by the CI
   pipeline and the live simulation UI — against the fully-hydrated graph.
4. Times `GraphService.scoreTimetable()` (institution-defined weighted
   scoring) against a handful of representative metric rules, since a fresh
   benchmark branch has no `rules.json` to read from GitHub.
5. Always flushes the scratch branch afterward, leaving no residue in
   Memgraph.

Before any timing starts, the script calls `ensureIndexes()`
(`backend/src/utils/schemaSetup.ts`) — the exact same call `container.ts`
makes at app boot — so the measured numbers reflect the same indexed
steady-state production actually runs with, not an artificially worse,
never-deployed unindexed one. Without this, every hydration `MERGE` (which
matches nodes by `{id, branchId}` properties, not internal node id) would be
a full label scan across every node of that label the shared Memgraph
instance has ever created.

It intentionally uses the exact same `GraphService`/`MemgraphClient` code
paths as the running API — this is not a separate, hand-tuned query, it is a
timed run of production code.

## Running it

Requires a real (non-mocked) Memgraph instance — the backend's unit test
suite mocks `IMemgraphClient` everywhere, so this is the only place in the
repo that exercises the Cypher against an actual database.

```bash
# From the repo root — starts Memgraph only (not the whole compose stack)
docker-compose up -d memgraph

cd backend
pnpm run benchmark
```

### Flags

```bash
pnpm run benchmark -- --scale=30000 --seed=42
```

| Flag      | Default | Meaning                                                                 |
|-----------|---------|--------------------------------------------------------------------------|
| `--scale` | `30000` | Number of classes to generate. Room/professor/group/course counts scale proportionally (see `generateDataset.ts`). Default matches the estimate in `docs/system-architecture.md` for a direct comparison. |
| `--seed`  | `42`    | PRNG seed. Same `scale`+`seed` always regenerates the identical dataset. |

Use a smaller `--scale` (e.g. `500`–`2000`) for a fast local sanity check —
the default institution-scale run can take a while to hydrate, by design;
that duration is the thing being measured.

## Interpreting the output

The script prints a timing table and a summary to stdout, and writes the full
result as JSON to `backend/benchmark-results/<timestamp>-scale<N>.json`
(gitignored — not committed by default, since it's a specific run's output,
not source). Each result contains:

```jsonc
{
  "scale": 30000,
  "seed": 42,
  "counts": { "classes": 30000, "rooms": 1200, "professors": 2000, /* ... */ },
  "timingsMs": {
    "hydration": 12345.6,       // time to load the dataset into Memgraph
    "queryConflicts": 234.5,    // time to run all four conflict-detection queries
    "scoreTimetable": 89.1,     // time to evaluate + weight the sample metric rules
    "total": 12669.2
  },
  "conflictCount": 842,
  "score": 61.4,
  "ranAt": "2026-08-17T12:00:00.000Z"
}
```

`queryConflicts`/`scoreTimetable` are the numbers that answer RQ1's "fast
enough for real-time use" question — they run against the *already-hydrated*
graph, which is the steady-state cost a user actually experiences once a
session is live. `hydration` is the one-time per-session setup cost the
architecture doc already discusses as a known trade-off.

## What this does *not* cover

- **Not run in CI.** Timing numbers from a shared CI runner are noisy and
  would misrepresent the measurement, so this stays a manually-run, documented
  script rather than a CI job. (`.github/workflows/ci.yml` *does* now start a
  `memgraph` service container and run real-Memgraph *correctness* tests on
  every push — see [`docs/testing.md`](./testing.md) — but that's a
  deliberately separate, deterministic suite; it doesn't run this timing
  script.)
- **Single-run, single-machine.** For a citable thesis-chapter number, run it
  a few times on consistent hardware and report the range/median rather than
  a single sample.
- **No concurrency.** This benchmarks one sequential session; it does not
  measure multiple simultaneous users (that's RQ3's stated non-goal at this
  scope level, not RQ1's).
- **Numbers filled in.** Run on a personal development machine (Intel Core
  i5-1135G7, 8 logical cores @ 2.40GHz, 2.8GiB RAM under WSL2) on 2026-09-29,
  seed 42, median of 3 runs per scale on a freshly-flushed Memgraph instance:

  | Scale | Hydration | `queryConflicts()` | `scoreTimetable()` | Conflicts | Score |
  |---|---|---|---|---|---|
  | 2,000 | 692.26 ms | 74.56 ms | 10.70 ms | 2,813 | 60.87 |
  | 10,000 | 1,263.40 ms | 350.32 ms | 35.68 ms | 13,360 | 61.32 |
  | 30,000 | 2,776.00 ms | 1,163.88 ms | 92.34 ms | 40,394 | 61.32 |

  These numbers supersede an earlier 2026-09-28 table that reported
  1,655,704.12 ms hydration and 875.81 ms `queryConflicts()` at 30,000
  classes. Both figures were real at the time but are no longer reproducible,
  for two independent reasons:

  - **Hydration** — the 2026-09-28 table predates commit `c5eb036` (composite
    `(id, branchId)` index on every hydrated label), which fixed hydration's
    quadratic MERGE-by-scan cost. Hydration now scales close to linearly;
    the "open engineering finding" / UNWIND-batching future-work note that
    used to live here (and still appears in
    `thesis/chapters/05_evaluation.tex` / `06_conclusion.tex`) is stale and
    needs a documentation/thesis pass of its own.
  - **`queryConflicts()`** — investigated 2026-09-29 after a ~25–30x
    regression was observed on a *re-run* of the 2026-09-28 figures (same
    code, same seed). Root cause: the 3 pairwise conflict queries in
    `GraphService.queryConflicts()` write two consecutive `MATCH` clauses
    (resource hop, then `SCHEDULED_AT`→`TimeSlot` hop) with nothing between
    them, so Memgraph's planner is free to pick either as the scan entry
    point. Its cost estimate uses raw per-branch label+property index
    cardinality, not post-expansion fan-out — and because `TimeSlot` count is
    fixed (~40, a day×period grid) while `Room`/`Professor`/`StudentGroup`
    counts scale with class count, the planner sometimes anchors on
    `TimeSlot` at institution scale, where each of the ~40 slots fans out to
    `scale/40` classes (750 at 30,000). `PROFILE` confirmed this directly:
    the professor/group queries anchored on `TimeSlot`
    (`ScanAllByLabelProperties (t :TimeSlot {branchId})`, ~41 hits) and took
    ~18.2s / ~18.3s each at 30,000-class scale, while the room query happened
    to anchor correctly on `Room` and took ~0.7s. Fix: insert a `WITH`
    barrier (and hoist `WHERE c1.id < c2.id` above it) between the two
    `MATCH` clauses in all 3 queries, forcing the planner to materialize the
    resource-anchored candidate set before considering the time-slot join —
    a semantics-preserving rewrite verified against the backend integration
    suite. Confirmed via `PROFILE` that this reliably forces the
    `Room`/`Professor`/`StudentGroup` entry point instead.
  - Separately, the shared Memgraph instance used for local development had
    accumulated 92 orphaned branches (~75,563 stray nodes) from interrupted
    debug/test sessions; these were flushed before this table was measured.
    This alone did not explain the regression (the bad plan reproduced
    identically on a freshly-flushed instance), but is worth keeping clean
    for benchmark reproducibility regardless.

  `queryConflicts()`/`scoreTimetable()` stay in the low-single-digit-second
  range (well under a second below 10,000 classes, ~1.2s at 30,000) — fast
  enough for the interactive, per-edit use RQ1 asks about, though the
  30,000-class `queryConflicts()` figure is now modestly higher than the
  original (misleading) 875.81 ms figure. Raw result files:
  `backend/benchmark-results/*.json` (gitignored, not committed).
