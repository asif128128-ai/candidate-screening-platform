import { afterAll, describe, expect, it } from "vitest";

// Red-team finding #9 (IMPORTANT): run_maintenance_sweep()'s own comment
// admitted the db_size invariant check was "left alone" — it wrote
// maintenance.db_size_bytes every sweep but never compared it against a
// threshold or raised an admin_alerts row, unlike the other 5 checks. Fixed
// in supabase/migrations/0011_db_size_sweep_check.sql by adding the missing
// check (factored into `evaluate_db_size_alert(bigint)` so it can be tested
// directly against a synthetic byte count, without needing a real multi-GB
// database) at the same 70%/90% thresholds src/lib/admin-format.ts's
// Settings-page banner already uses.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

const DB_PLAN_BYTES = 8 * 1024 * 1024 * 1024; // matches src/lib/admin-format.ts

describe.runIf(hasDb)("db_size sweep invariant (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let closePool: typeof import("@/db/postgres").closePool;

  async function clearDbSizeAlert() {
    await withSystem((tx) => tx`delete from admin_alerts where code = 'db_size'`);
  }

  it("setup", async () => {
    ({ withSystem, closePool } = await import("@/db/postgres"));
    await clearDbSizeAlert();
  });

  it("below the 70% threshold: no db_size alert is raised", async () => {
    await withSystem((tx) => tx`select evaluate_db_size_alert(${Math.floor(DB_PLAN_BYTES * 0.5)})`);
    const rows = await withSystem((tx) =>
      tx<{ count: string }[]>`select count(*)::text as count from admin_alerts where code = 'db_size'`,
    );
    expect(Number(rows[0]!.count)).toBe(0);
  });

  it("crossing 70%: a 'warning' db_size admin_alerts row is raised (mirrors the Settings-page banner)", async () => {
    const bytes = Math.floor(DB_PLAN_BYTES * 0.75);
    await withSystem((tx) => tx`select evaluate_db_size_alert(${bytes})`);
    const rows = await withSystem((tx) =>
      tx<{ severity: string; message_he: string; meta: { db_size_bytes: number } }[]>`
        select severity, message_he, meta from admin_alerts where code = 'db_size'
      `,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.severity).toBe("warning");
    expect(rows[0]!.meta.db_size_bytes).toBe(bytes);
  });

  it("crossing 90%: severity escalates to 'critical' on the same alert row (upsert, not a duplicate)", async () => {
    const bytes = Math.floor(DB_PLAN_BYTES * 0.95);
    await withSystem((tx) => tx`select evaluate_db_size_alert(${bytes})`);
    const rows = await withSystem((tx) =>
      tx<{ severity: string }[]>`select severity from admin_alerts where code = 'db_size'`,
    );
    expect(rows).toHaveLength(1); // still just one row — upserted, not a second alert
    expect(rows[0]!.severity).toBe("critical");
  });

  it("dropping back below 70% clears the alert (self-clearing, like every other sweep check)", async () => {
    await withSystem((tx) => tx`select evaluate_db_size_alert(${Math.floor(DB_PLAN_BYTES * 0.5)})`);
    const rows = await withSystem((tx) =>
      tx<{ count: string }[]>`select count(*)::text as count from admin_alerts where code = 'db_size'`,
    );
    expect(Number(rows[0]!.count)).toBe(0);
  });

  it("run_maintenance_sweep() still unconditionally records maintenance.db_size_bytes (unchanged behavior)", async () => {
    await withSystem((tx) => tx`update maintenance set last_sweep = now() - interval '2 hours' where id = true`);
    await withSystem((tx) => tx`select run_maintenance_sweep()`);
    const rows = await withSystem((tx) =>
      tx<{ db_size_bytes: string | null }[]>`select db_size_bytes from maintenance where id = true`,
    );
    expect(rows[0]!.db_size_bytes).not.toBeNull();
    expect(Number(rows[0]!.db_size_bytes)).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await clearDbSizeAlert();
    await closePool();
  });
});
