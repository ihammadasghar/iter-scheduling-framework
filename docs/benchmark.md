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
  would misrepresent the measurement, so this is a manually-run, documented
  script rather than a CI job. `docker-compose.yml`'s `memgraph` service also
  isn't started by the existing CI workflow (`.github/workflows/ci.yml`),
  which only runs lint/tests.
- **Single-run, single-machine.** For a citable thesis-chapter number, run it
  a few times on consistent hardware and report the range/median rather than
  a single sample.
- **No concurrency.** This benchmarks one sequential session; it does not
  measure multiple simultaneous users (that's RQ3's stated non-goal at this
  scope level, not RQ1's).
