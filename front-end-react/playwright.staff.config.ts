import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// Separate ports let Claude's W4 browser checks run without collisions.
export default defineConfig({
  ...base,
  outputDir: 'test-results-staff',
  testMatch: 'staff.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5175' },
  webServer: [
    {
      command:
        'npm --prefix ../back-end run build && node ../back-end/dist/main.js',
      url: 'http://127.0.0.1:3102/',
      env: {
        PORT: '3102',
        NODE_ENV: 'test',
        LOGIN_RATE_LIMIT_PER_MIN: '100',
        JWT_SECRET: 'staff-test-only-secret-at-least-32-characters',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3102', VITE_API_URL: '/api' },
      reuseExistingServer: false,
    },
  ],
});
