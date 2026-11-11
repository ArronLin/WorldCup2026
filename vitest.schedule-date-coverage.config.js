import { mergeConfig, defineConfig } from 'vite';
import base from './vite.config.js';

export default mergeConfig(base, defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.js', 'netlify/functions/**/*.mjs',
        'scripts/check-added-coverage.mjs', 'scripts/run-unit-coverage.mjs', 'scripts/validate-data.mjs'],
    },
  },
}));
