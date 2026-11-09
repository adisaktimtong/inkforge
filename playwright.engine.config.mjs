import { defineConfig } from '@playwright/test';
const development = process.env.INKFORGE_ENGINE_DEV === '1', port = development ? 3222 : 3221;
export default defineConfig({
  testDir: './tests/engine-surface', testMatch: development ? '**/development.spec.ts' : '**/engine.spec.ts',
  timeout: 25000, retries: 0, workers: 1,
  reporter: [['list'], ['json', { outputFile: `.artifacts/u07c-${development ? 'development' : 'browser'}.json` }]],
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', launchOptions: { executablePath: '/usr/bin/chromium' } } }],
  webServer: { command: `node node_modules/next/dist/bin/next ${development ? 'dev --webpack' : 'start'} --hostname 127.0.0.1 --port ${port}`,
    cwd: process.env.INKFORGE_ENGINE_CONSUMER, url: `http://127.0.0.1:${port}/engine`, reuseExistingServer: false, timeout: 60000 },
});
