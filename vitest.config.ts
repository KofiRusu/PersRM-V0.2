import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
}); 