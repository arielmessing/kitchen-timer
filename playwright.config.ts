import { defineConfig, devices } from '@playwright/test';

const TARGET_URL = 'http://localhost:4173/kitchen-timer/';

export default defineConfig({
  testDir: './',
  reporter: 'html',
  use: {
    baseURL: TARGET_URL,
    screenshot: 'only-on-failure',
  },

  // Compile the app and spins up the webServer BEFORE running any tests, then tear it down
  webServer: {
    command: 'npm run build && npm run preview',
    url: TARGET_URL,
    timeout: 120 * 1000, // 2 minutes max for build + startup
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});