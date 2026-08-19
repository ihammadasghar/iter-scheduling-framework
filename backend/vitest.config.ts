import { defineConfig } from 'vitest/config';
import AllureReporter from 'allure-vitest/reporter';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Integration tests need a real, reachable Memgraph (see
    // GraphService.integration.test.ts) — keep them out of the default
    // fast/mocked `vitest run` and run them explicitly via
    // `pnpm run test:integration` (see docs/testing.md and ci.yml). Same for
    // e2e tests (see src/e2e/**) — run explicitly via `pnpm run test:e2e`.
    exclude: ['dist/**', 'node_modules/**', 'src/**/*.integration.test.ts', 'src/e2e/**'],
    reporters: [
      'default',
      new AllureReporter({ resultsDir: 'allure-results' }),
    ],
  },
});
