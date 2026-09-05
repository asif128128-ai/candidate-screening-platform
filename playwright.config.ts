import { defineConfig, devices } from "@playwright/test";

// TEST_STRATEGY.md §1, §5: Chromium + Firefox + WebKit; Hebrew RTL, Asia/
// Jerusalem timezone, 1366x768 default viewport, a 390x844 mobile project.
// `webServer` boots the app so CI can run this against a real (if mostly
// placeholder, at this stage) build.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // Dev mode deliberately: this stage of the app has no live Supabase
    // backend to point a production build at, and the placeholder pages
    // don't need one. `pnpm start` (production) requires the full env var
    // set (scripts/check-env.ts prestart hook) — switch this to
    // `pnpm build && pnpm start` once there's a real backend for the nightly
    // full-matrix run to exercise (TEST_STRATEGY.md §1).
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
