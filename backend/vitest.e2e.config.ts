import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/e2e/**/*.test.ts'],
    // Every e2e file spins up its own Express app/container, but they all
    // write to the SAME real (not mocked) Memgraph instance. Running two
    // files' graph.hydrate/flush cycles at literally the same wall-clock
    // time causes intermittent write-conflict failures unrelated to either
    // test's actual assertions (observed directly: adding one extra request
    // to one file was enough to tip an unrelated file's score computation
    // into cross-contamination). Concurrency *within* a file is still fine —
    // this only forces separate files to run one at a time.
    fileParallelism: false,
  },
});
