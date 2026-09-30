import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      reportsDirectory: './coverage',
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
    },
  },
});