import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 120000,
    testTimeout: 90000,
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});