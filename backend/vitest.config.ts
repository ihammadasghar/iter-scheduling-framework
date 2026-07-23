import { defineConfig } from 'vitest/config';
import AllureReporter from 'allure-vitest/reporter';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/e2e/**'],
    reporters: [
      'default',
      new AllureReporter({ resultsDir: 'allure-results' }),
    ],
  },
});
