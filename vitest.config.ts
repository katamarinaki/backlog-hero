import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/shared/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/shared/types.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
