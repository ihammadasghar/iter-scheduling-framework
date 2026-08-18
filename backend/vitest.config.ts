import { defineConfig } from 'vitest/config';
import AllureReporter from 'allure-vitest/reporter';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Integration tests need a real, reachable Memgraph (see
    // GraphService.integration.test.ts) — keep them out of the default
    // fast/mocked `vitest run` and run them explicitly via
    // `pnpm run test:integration` (see docs/testing.md and ci.yml).
    exclude: ['dist/**', 'node_modules/**', 'src/**/*.integration.test.ts'],
    reporters: [
      'default',
      new AllureReporter({ resultsDir: 'allure-results' }),
    ],
  },
});
