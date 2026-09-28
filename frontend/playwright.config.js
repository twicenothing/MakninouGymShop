import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  use: { browserName: 'chromium', headless: true, screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev:store', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npm run dev:admin', url: 'http://127.0.0.1:5174', reuseExistingServer: true }
  ]
});
