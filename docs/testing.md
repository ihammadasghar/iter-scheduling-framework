# Testing

## Unit tests (mocked)

The default test suites for both packages mock `IMemgraphClient`/
`neo4j-driver` and `IGitHubService` completely — no network access, no
Docker required.

```bash
cd backend && pnpm test        # or: pnpm test:coverage
cd frontend && pnpm test       # or: pnpm test:coverage
```

## Integration tests (real Memgraph)

`backend/src/services/GraphService.integration.test.ts` is the one place in
the repo that executes Cypher against a real, non-mocked Memgraph instance.
It exists to prove things a mocked test structurally cannot: that
`queryConflicts()`'s `g.size > r.capacity` predicate actually fires (and
doesn't) against real data, and that `Professor:avg_gap_length`'s averaging
arithmetic — which lives entirely inside the Cypher string, since
`evaluateMetrics()` does no JS-side aggregation — actually computes the right
number.

These are correctness assertions, not timing measurements — see
[`docs/benchmark.md`](./benchmark.md) for the (separate, still manual-only)
performance benchmark.

### Running locally

```bash
# From the repo root — starts Memgraph only (not the whole compose stack)
docker-compose up -d memgraph

cd backend
pnpm run test:integration
```

Uses the same `MEMGRAPH_URI`/`MEMGRAPH_USERNAME`/`MEMGRAPH_PASSWORD` env vars
as `container.ts` and `benchmark.ts` (default: `bolt://localhost:7687`, no
auth). Each test hydrates a dedicated `integration-test-<uuid>` scratch
branch and flushes it in `afterEach`, so runs don't interfere with each other
or leave residue in Memgraph.

Kept in a separate `vitest.integration.config.ts` (own `include` glob) rather
than a CLI filter against the default config, since the default
`vitest.config.ts` explicitly excludes `*.integration.test.ts` from
`pnpm test` — a CLI glob argument doesn't override that exclude.

### Running in CI

`.github/workflows/ci.yml`'s backend job starts a `memgraph` service
container (mirroring `docker-compose.yml`'s service definition) and runs
`pnpm run test:integration` as its own step, after the mocked
`pnpm test:coverage` step. It runs on every push/PR, unlike the perf
benchmark, because these are fast and deterministic — nothing about them is
noisier on a shared CI runner the way a timing measurement would be.
