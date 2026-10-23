import { defineConfig, devices } from '@playwright/test';

// Смоук-тести ганяються проти зібраного сайту (npm run build → astro preview).
export default defineConfig({
  testDir: 'tests/smoke',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --ignore-lock: інакше Astro, побачивши ШІ-агента, сам іде у фон, і Playwright вважає, що сервер упав.
    command: 'npx astro preview --port 4321 --ignore-lock',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
