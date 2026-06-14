import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const baseURL = `http://localhost:${PORT}`

/**
 * UI-only smoke tests: they run against the real Vite dev server but never reach
 * Supabase (validation/invalid-input paths return before any network call), so
 * no rooms or votes are created. A full create->vote->export flow is deferred
 * until there's a throwaway database to point it at — see docs/decisions.md.
 */
export default defineConfig({
  testDir: './browser',
  // Fail the build if test.only is left in the source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the app automatically; reuse a running dev server locally.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
