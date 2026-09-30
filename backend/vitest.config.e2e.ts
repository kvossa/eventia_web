import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 120000,
    testTimeout: 90000,
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      all: true,
      reportsDirectory: './coverage-e2e',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/migrations/**',
        'src/config/data-source.ts',
        'src/seed.ts',
        'src/seed-data.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 84,
        lines: 84,
      },
    },
  },
});