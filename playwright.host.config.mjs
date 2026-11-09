import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/host-boundary',
  testMatch: '**/host.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 25000,
  reporter: [['list'], ['json', { outputFile: '.artifacts/u07d-browser.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3223',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', launchOptions: { executablePath: '/usr/bin/chromium' } },
    },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3223',
    cwd: process.env.INKFORGE_HOST_CONSUMER,
    url: 'http://127.0.0.1:3223/host',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
