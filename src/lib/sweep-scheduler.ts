import { runSweep } from "@/lib/health-check";
import { drainCvPurgeQueue } from "@/lib/cv-purge";

// ARCHITECTURE.md §8 / DEPLOYMENT.md §9: the hourly maintenance sweep.
//
// The sweep used to run inside the /api/health handler, which made it a
// side effect of being probed. That coupling turned any outage longer than
// the staleness threshold into a permanent one: no instance serving
// /api/health means no sweep, `sweep_age_min` climbs past 180, and from
// then on every deploy fails its own health check and gets rolled back —
// with the original fault long since fixed. The sweep now runs on its own
// clock so a down service cannot starve it.
//
// It also drains `cv_purge_queue` (src/lib/cv-purge.ts) — the queue that had
// no consumer at all until 2026-09-09, which is what actually took the
// service down (a row older than 24 h returned 503 forever).
//
// Started lazily, once per server process, from the first /api/health call
// rather than from `instrumentation.ts`'s `register()` — same constraint
// that src/lib/outage-boot-check.ts documents at length: instrumentation.ts
// is compiled for both the nodejs and edge runtimes, and anything reaching
// src/db/postgres.ts (real node net/tls/crypto/stream) fails the edge
// bundle at build time even behind a runtime NEXT_RUNTIME check, because
// webpack still has to resolve the import graph for the edge target.
//
// Render probes /api/health every 30 s and UptimeRobot every 5 min, so the
// first probe — and therefore the scheduler start — happens within seconds
// of boot.

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly; the staleness alarm is 180 min

let started = false;

/**
 * Idempotent. Kicks off an immediate sweep, then one every hour for the
 * life of the process. Never throws and never rejects — a failing sweep
 * must not be able to fail the health probe that started it; a persistent
 * failure surfaces as a climbing `sweep_age_min` in the probe's own output.
 */
export function ensureSweepSchedulerStarted(): void {
  if (started) return;
  started = true;

  void sweepOnce();

  const timer = setInterval(() => {
    void sweepOnce();
  }, SWEEP_INTERVAL_MS);

  // Don't hold the event loop open on shutdown.
  timer.unref?.();
}

async function sweepOnce(): Promise<void> {
  try {
    await runSweep();
  } catch (err) {
    console.error(JSON.stringify({ event: "maintenance_sweep_failed", error: String(err) }));
  }

  // Separate try/catch on purpose: the CV purge talks to Storage, so it has
  // a whole failure domain of its own, and a Storage outage must not stop
  // the database-side sweep above from running (or vice versa).
  try {
    await drainCvPurgeQueue();
  } catch (err) {
    console.error(JSON.stringify({ event: "cv_purge_drain_failed", error: String(err) }));
  }
}

/** Test seam: lets a test reset the module-level guard between cases. */
export function resetSweepSchedulerForTests(): void {
  started = false;
}
