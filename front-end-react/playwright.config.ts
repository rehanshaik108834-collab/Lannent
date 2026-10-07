import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'npm --prefix ../back-end run build && node ../back-end/dist/main.js',
      url: 'http://127.0.0.1:3101/',
      env: {
        PORT: '3101',
        NODE_ENV: 'test',
        JWT_SECRET: 'browser-test-only-secret-at-least-32-characters',
        // Several journeys sign in many accounts; production keeps the default limit.
        LOGIN_RATE_LIMIT_PER_MIN: '100',
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3101', VITE_API_URL: '/api' },
      reuseExistingServer: false,
    },
  ],
});
