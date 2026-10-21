import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  test: {
    environment: 'node',
    maxWorkers: 4,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'netlify/functions/**/*.mjs'],
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
