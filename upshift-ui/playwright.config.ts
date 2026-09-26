import { defineConfig } from '@playwright/test'

// End-to-end tests against the production build (vite preview on :4173, proxying /api to the backend
// on :8080). Start the backend first (see README), then: npm run e2e
// The dev server isn't used: React StrictMode double-runs effects there, which doubles API calls.
export default defineConfig({
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  testDir: './e2e',
  timeout: 180_000, // real Claude calls (web search can take ~20s)
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    channel: 'chrome', // use the installed Chrome; no browser download needed
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /api\.spec\.ts/ },
    { name: 'ui', testMatch: /ui\.spec\.ts/ },
  ],
})
