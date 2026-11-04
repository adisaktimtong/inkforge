import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: __dirname,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    {
      command: 'pnpm --filter react-playground exec vite --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter next-demo exec next start --hostname 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174/editor',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
