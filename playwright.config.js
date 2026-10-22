import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 2,
  reporter: process.env.REPO_SDD_CONTEXT ? [['line'], ['junit', { outputFile: '.tmp/reporting/browser.xml' }]] : [['list']],
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
