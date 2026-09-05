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
  // Not fullyParallel, and pinned to one worker: every spec file here runs
  // against the SAME shared Postgres instance and the SAME fixed dev-seed
  // data (scripts/dev-seed.sql — e.g. every admin-candidates.spec.ts lookup
  // of "יעל כהן" assumes that row and the surrounding list/pagination state
  // are undisturbed). assessment-runner.spec.ts already discovered and
  // documented this for tests *within* one file (`test.describe.configure({
  // mode: "serial" })`); running the full suite together for the first time
  // (previously only individual files had ever been run, and CI itself only
  // exercises smoke.spec.ts — see ci.yml) showed the same problem *across*
  // files: concurrent workers each creating/editing/deleting jobs and
  // candidates raced the fixed-name lookups other files depend on
  // (admin-candidates.spec.ts failed intermittently only when run alongside
  // admin-jobs.spec.ts/candidate-flow.spec.ts/assessment-runner.spec.ts, never
  // alone). None of these failures point to an application bug — every
  // suite passes cleanly on its own. Real isolation (a fresh database per
  // worker) is the eventual right fix if this suite's runtime becomes a
  // problem; until then, correctness over speed.
  fullyParallel: false,
  workers: 1,
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
    // Production build, not `pnpm dev`: every engineer's pass through this
    // repo independently hit the same dev-mode symptom — a Server
    // Action/route round trip occasionally (or, once the app got heavy
    // enough, close to consistently) taking 30-120+ seconds under dev's
    // on-demand/lazy route compilation, with no such delay outside
    // `next dev`. That's exactly what was timing out the assessment-runner
    // e2e suite's very first navigation. `pnpm start` needs the full env
    // var set (scripts/check-env.ts's `prestart` hook) and a real
    // Postgres — both are available now (./scripts/local-pg-setup.sh) — so
    // there's no longer a reason to defer this, as three prior passes'
    // notes in IMPLEMENTATION_NOTES.md each did in turn.
    command: `pnpm build && pnpm start`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT },
  },
});
