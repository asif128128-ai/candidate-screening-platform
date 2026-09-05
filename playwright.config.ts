import { defineConfig, devices } from "@playwright/test";

// TEST_STRATEGY.md §1, §5: Chromium + Firefox + WebKit; Hebrew RTL, Asia/
// Jerusalem timezone, 1366x768 default viewport, a 390x844 mobile project.
// `webServer` boots the app so CI can run this against a real (if mostly
// placeholder, at this stage) build.
//
// Port is overridable via PLAYWRIGHT_PORT (default 3000): in a sandbox
// where multiple worktrees/agents may run `pnpm dev` concurrently, a fixed
// port collides with another instance and this suite would silently test
// against the WRONG app/data. Set PLAYWRIGHT_PORT to a free port instead of
// hardcoding a different default — nothing changes for a normal single-
// instance run.
const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
    command: `pnpm dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
