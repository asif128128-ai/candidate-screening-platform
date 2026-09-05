import { loadEnv } from "./env";

// ARCHITECTURE.md §5.2 hot path (served_at/deadline_at/wall-clock) needs a
// single "now" the whole assessment stack agrees on. `TEST_CLOCK_OFFSET_MS`
// (declared in env.ts, refused in production by assertProductionInvariants)
// lets Playwright e2e tests move the server's notion of "now" forward
// without waiting out real 20s/60s/180s item timers (TEST_STRATEGY.md §5:
// "Timer tests use the test clock"). Unit tests inject `now()` directly into
// the pure `src/assessment/timing.ts` functions instead of using this.
export function now(): Date {
  const env = loadEnv();
  const offset = env.TEST_CLOCK_OFFSET_MS ?? 0;
  return offset === 0 ? new Date() : new Date(Date.now() + offset);
}
