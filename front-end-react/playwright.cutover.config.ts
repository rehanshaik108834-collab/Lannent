import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  outputDir: 'test-results-cutover',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3103', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'npm --prefix ../back-end run build:all && node ../back-end/dist/main.js',
    url: 'http://127.0.0.1:3103/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: '3103',
      VITE_API_URL: '/api',
      NODE_ENV: 'test',
      LOGIN_RATE_LIMIT_PER_MIN: '100',
      JWT_SECRET: 'cutover-test-only-secret-at-least-32-characters',
    },
  },
});
