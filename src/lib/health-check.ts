import { withSystem } from "@/db/postgres";

// Extracted from src/app/api/health/route.ts so it can be unit/integration
// tested directly (Next.js route handler modules only recognize a fixed set
// of exports, so testable business logic lives here instead — see
// IMPLEMENTATION_STATE.md's health-check red-team fix entry).

export interface CheckDbResult {
  ok: boolean;
  schemaVersion: string | null;
  sweepAgeMin: number | null;
  purgeBacklog: number;
}

export async function checkDb(): Promise<CheckDbResult> {
  return withSystem(async (tx) => {
    await tx`select 1`;

    // Migration-version check (DEPLOYMENT.md §5). The `supabase_migrations`
    // schema is created by the Supabase CLI itself; guard for local/dev
    // setups where it may not exist yet.
    //
    // Red-team finding #2 (CRITICAL): the try/catch alone does NOT protect
    // the surrounding transaction — once this query fails (e.g. the
    // `supabase_migrations` schema genuinely doesn't exist, as on this
    // local-Postgres stand-in, or any other transient error), Postgres
    // aborts the *whole transaction*, and every subsequent statement in it
    // — including `run_maintenance_sweep()` below — then fails too with a
    // generic "current transaction is aborted" error, silently disabling the
    // sweep. Fixed by running this optional lookup inside its own SAVEPOINT
    // and rolling back to it (not the whole transaction) on failure, so a
    // failure here can never poison anything that runs after it in this tx.
    let schemaVersion: string | null = null;
    try {
      const rows = await tx.savepoint(async (sp) => {
        return sp<{ version: string }[]>`
          select version from supabase_migrations.schema_migrations
          order by version desc limit 1
        `;
      });
      schemaVersion = rows[0]?.version ?? null;
    } catch {
      schemaVersion = null; // treated as "unknown" by the caller, not a hard failure locally
    }

    // Opportunistically run the sweep — no-ops if another caller already
    // won this hour's lock (ARCHITECTURE.md §8).
    await tx`select run_maintenance_sweep()`;

    const maintenanceRows = await tx<{ last_sweep: Date }[]>`
      select last_sweep from maintenance where id = true
    `;
    const lastSweep = maintenanceRows[0]?.last_sweep ?? null;
    const sweepAgeMin = lastSweep
      ? Math.round((Date.now() - new Date(lastSweep).getTime()) / 60000)
      : null;

    const purgeRows = await tx<{ count: string }[]>`
      select count(*)::text as count from cv_purge_queue
      where enqueued_at < now() - interval '24 hours'
    `;
    const count = purgeRows[0]?.count ?? "0";

    return { ok: true, schemaVersion, sweepAgeMin, purgeBacklog: Number(count) };
  });
}
