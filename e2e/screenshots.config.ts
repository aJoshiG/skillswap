import { defineConfig, devices } from '@playwright/test';

/** `npm run screenshots`: regenerates the README images in docs/images (not part of CI). */
export default defineConfig({
  testDir: './screenshots',
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4300',
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [{ name: 'screenshots', use: { ...devices['Desktop Chrome'] } }],
});
