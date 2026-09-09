import { NextResponse } from "next/server";
import { loadEnv } from "@/lib/env";
import { checkDb } from "@/lib/health-check";
import { ensureSweepSchedulerStarted } from "@/lib/sweep-scheduler";
import { EXPECTED_SCHEMA_VERSION } from "@/generated/schema-version";

// DEPLOYMENT.md §9, ARCHITECTURE.md §8, §10. Render pings this every 30 s,
// UptimeRobot every 5 min, for the life of the service.
//
// What a 503 here MEANS (this distinction is the whole point of the file):
// Render treats a non-200 as "this instance cannot serve traffic" and will
// fail the deploy and roll back. So 503 is reserved for exactly that —
// conditions where serving requests would be wrong:
//
//   db_error           the database is unreachable; nothing works
//   migration_pending  the DB schema is not the one this build was compiled
//                      against, so serving would read/write the wrong shape
//                      (this is the guard that lets Render auto-roll-back a
//                      deploy whose migration was never applied)
//
// Everything else is *operational backlog*: real, needs a human, but this
// instance serves traffic correctly and taking it down makes things worse,
// not better. Those report `status: "degraded"` with HTTP 200 and are
// raised to Sentry (-> ALERT_EMAIL) instead:
//
//   sweep_stale        the maintenance sweep hasn't run in > 3 h
//   cv_purge_backlog   CV rows queued for deletion > 24 h ago
//
// Previously both of these returned 503, which was actively harmful:
// `sweep_stale` in particular was self-inflicted, because the sweep only
// ran as a side effect of this endpoint being probed. Any outage lasting
// longer than the 180-minute threshold therefore became permanent — the
// sweep could never run again, so every subsequent deploy failed its health
// check and rolled back, with the original fault already fixed. The sweep
// now runs on its own timer (src/lib/sweep-scheduler.ts) and staleness is
// only reported here, never enforced.
//
// No git SHA in this response (DECISIONS_LOG.md #12 "also"; it's on the
// admin Settings page instead, behind auth).

export const dynamic = "force-dynamic";

interface HealthBody {
  status: "ok" | "degraded" | "error";
  db: "ok" | "error";
  storage: "ok" | "error" | "unknown";
  migrations: "ok" | "pending" | "error";
  email: "ok" | "disabled";
  sweep_age_min: number | null;
  cv_purge_backlog: number;
  reason?: string;
  degraded?: string[];
}

async function alert(reason: string, detail: Record<string, unknown>): Promise<void> {
  console.error(JSON.stringify({ route: "/api/health", event: reason, ...detail }));
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(`health: ${reason}`, {
      level: "warning",
      extra: detail,
    });
  } catch {
    // Alerting must never be what takes the health check down.
  }
}

export async function GET() {
  const env = loadEnv();

  // Independent of this request's outcome — see the module comment.
  ensureSweepSchedulerStarted();

  const body: HealthBody = {
    status: "ok",
    db: "ok",
    storage: "unknown",
    migrations: "ok",
    email: env.EMAIL_ENABLED === "true" ? "ok" : "disabled",
    sweep_age_min: null,
    cv_purge_backlog: 0,
  };
  let httpStatus = 200;
  const degraded: string[] = [];

  try {
    const { schemaVersion, sweepAgeMin, purgeBacklog } = await checkDb();
    body.sweep_age_min = sweepAgeMin;
    body.cv_purge_backlog = purgeBacklog;

    // Fatal: this build does not match the schema it is talking to.
    if (schemaVersion !== null && schemaVersion !== EXPECTED_SCHEMA_VERSION) {
      body.migrations = "pending";
      body.status = "error";
      body.reason = "migration_pending";
      httpStatus = 503;
      await alert("migration_pending", {
        db_head: schemaVersion,
        expected: EXPECTED_SCHEMA_VERSION,
      });
    }

    // Degraded: needs attention, but this instance still serves correctly.
    if (sweepAgeMin !== null && sweepAgeMin > 180) {
      degraded.push("sweep_stale");
      await alert("sweep_stale", { sweep_age_min: sweepAgeMin });
    }

    if (purgeBacklog > 0) {
      // Backlog itself isn't fatal below 24h (that's the query's own
      // threshold), so any row returned here is already > 24h old.
      degraded.push("cv_purge_backlog");
      await alert("cv_purge_backlog", { cv_purge_backlog: purgeBacklog });
    }
  } catch (err) {
    body.db = "error";
    body.status = "error";
    body.reason = "db_error";
    httpStatus = 503;
    console.error(
      JSON.stringify({ route: "/api/health", event: "db_check_failed", error: String(err) }),
    );
  }

  if (degraded.length > 0) {
    body.degraded = degraded;
    if (body.status === "ok") {
      body.status = "degraded";
      body.reason = degraded[0];
    }
  }

  // TODO(next engineer wiring Storage): HEAD request on the `cv` bucket via
  // the service-role client, cached 60 s (DEPLOYMENT.md §9). Left as
  // "unknown" rather than a fake "ok" so this isn't silently wrong.

  return NextResponse.json(body, { status: httpStatus });
}
