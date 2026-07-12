import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
  },

  /*
    This webServer block compiles the app and spins up
    the server BEFORE running any tests, then tears it down.
  */
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    timeout: 120 * 1000, // 2 minutes max for build + startup
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});