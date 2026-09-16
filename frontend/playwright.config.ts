import { defineConfig, devices } from '@playwright/test'

/**
 * E2E suite. IMPORTANT: the dev server points at the LIVE Supabase project,
 * so every spec must stay READ-ONLY — no signups, no trades, no posts.
 * Specs assert on public journeys: home, artist page/chart, search API,
 * leaderboard, public profiles, and the mobile-width + side-rail behaviors.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\..*\.spec\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testMatch: /mobile\..*\.spec\.ts/,
    },
  ],
})
