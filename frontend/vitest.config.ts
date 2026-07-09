import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import AllureReporter from 'allure-vitest/reporter';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    reporters: [
      'default',
      new AllureReporter({ resultsDir: 'allure-results' }),
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        'src/store/**': { lines: 80, functions: 80 },
        'src/utils/**': { lines: 90, functions: 90 },
      },
    },
  },
});
