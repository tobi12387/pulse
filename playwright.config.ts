import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const certDir = path.resolve(process.cwd(), 'frontend/certs');
const hasLocalHttps =
  fs.existsSync(path.join(certDir, '192.168.178.46+2-key.pem')) &&
  fs.existsSync(path.join(certDir, '192.168.178.46+2.pem'));
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `${hasLocalHttps ? 'https' : 'http'}://127.0.0.1:5173`;

export default defineConfig({
  testDir: './frontend/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -w frontend -- --host=127.0.0.1 --port=5173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    ...(process.env.PULSE_E2E_WEBKIT === 'true'
      ? [{
          name: 'iphone-webkit',
          use: { ...devices['iPhone 15'] },
        }]
      : []),
  ],
});
