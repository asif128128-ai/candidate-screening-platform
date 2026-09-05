import { NextResponse } from "next/server";
import { loadEnv } from "@/lib/env";
import { checkDb } from "@/lib/health-check";
import { EXPECTED_SCHEMA_VERSION } from "@/generated/schema-version";

// DEPLOYMENT.md §9, ARCHITECTURE.md §8, §10: this is the platform's only
// scheduler. Render pings it every 30 s, UptimeRobot every 5 min, for the
// life of the service. On each call it (a) checks DB/storage/migration
// health, (b) opportunistically runs the hourly maintenance sweep (which
// no-ops immediately if another caller already won this hour's lock), and
// (c) returns 503 whenever something requires attention, which is what
// makes UptimeRobot's alert meaningful and lets Render auto-rollback a bad
// deploy (migration mismatch).
//
// No git SHA in this response (DECISIONS_LOG.md #12 "also"; it's on the
// admin Settings page instead, behind auth).

export const dynamic = "force-dynamic";

interface HealthBody {
  status: "ok" | "error";
  db: "ok" | "error";
  storage: "ok" | "error" | "unknown";
  migrations: "ok" | "pending" | "error";
  email: "ok" | "disabled";
  sweep_age_min: number | null;
  cv_purge_backlog: number;
  reason?: string;
}

export async function GET() {
  const env = loadEnv();
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

  try {
    const { schemaVersion, sweepAgeMin, purgeBacklog } = await checkDb();
    body.sweep_age_min = sweepAgeMin;
    body.cv_purge_backlog = purgeBacklog;

    if (schemaVersion !== null && schemaVersion !== EXPECTED_SCHEMA_VERSION) {
      body.migrations = "pending";
      body.status = "error";
      body.reason = "migration_pending";
      httpStatus = 503;
    }

    if (sweepAgeMin !== null && sweepAgeMin > 180) {
      body.status = "error";
      body.reason = body.reason ?? "sweep_stale";
      httpStatus = 503;
    }

    if (purgeBacklog > 0) {
      // Backlog itself isn't fatal below 24h (that's the query's own
      // threshold), so any row returned here is already > 24h old.
      body.status = "error";
      body.reason = body.reason ?? "cv_purge_backlog";
      httpStatus = 503;
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

  // TODO(next engineer wiring Storage): HEAD request on the `cv` bucket via
  // the service-role client, cached 60 s (DEPLOYMENT.md §9). Left as
  // "unknown" rather than a fake "ok" so this isn't silently wrong.

  return NextResponse.json(body, { status: httpStatus });
}
