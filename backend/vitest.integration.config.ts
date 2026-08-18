import { defineConfig } from 'vitest/config';

// Separate config (rather than a CLI glob against vitest.config.ts) so this
// suite isn't fighting that config's `exclude: ['**/*.integration.test.ts']`
// — see vitest.config.ts and docs/testing.md. Requires a real Memgraph
// reachable via MEMGRAPH_URI (default bolt://localhost:7687).
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    // Real network calls per test; the default 5s hook/test timeout is
    // comfortably enough for these small fixtures against a local
    // Memgraph, but give hydration/index setup a bit more room.
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
