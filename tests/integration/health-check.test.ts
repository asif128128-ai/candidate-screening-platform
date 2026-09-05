import { afterAll, describe, expect, it } from "vitest";

// Red-team finding #2 (CRITICAL): the try/catch around the optional
// `supabase_migrations.schema_migrations` lookup in checkDb() did not
// actually protect the surrounding transaction — once that query failed
// (e.g. the schema doesn't exist, exactly the case on this local-Postgres
// stand-in, which has no Supabase CLI managing that schema), Postgres
// aborted the whole transaction, so the very next statement
// (`run_maintenance_sweep()`) failed too with a generic cascading error,
// silently and permanently disabling the sweep from that point on.
//
// This suite reproduces the original bug directly against this local
// Postgres (no `supabase_migrations` schema exists here — see
// scripts/local-pg-setup.sh / supabase/test-stubs.sql) and proves
// run_maintenance_sweep() still runs despite it.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

describe.runIf(hasDb)("checkDb() (integration, local Postgres — no supabase_migrations schema)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let checkDb: typeof import("@/lib/health-check").checkDb;
  let closePool: typeof import("@/db/postgres").closePool;

  it("the supabase_migrations schema genuinely does not exist here (precondition for the repro)", async () => {
    ({ withSystem, closePool } = await import("@/db/postgres"));
    ({ checkDb } = await import("@/lib/health-check"));

    const rows = await withSystem((tx) =>
      tx<{ exists: boolean }[]>`
        select exists(select 1 from information_schema.schemata where schema_name = 'supabase_migrations') as exists
      `,
    );
    expect(rows[0]?.exists).toBe(false);
  });

  it("run_maintenance_sweep() still runs and maintenance.last_sweep still advances despite the schema-version lookup failing", async () => {
    // Force the sweep's hourly lock open so this call is guaranteed to win
    // it (otherwise a sweep run earlier in this test session could make
    // this a no-op and the assertion below wouldn't prove anything).
    await withSystem((tx) => tx`update maintenance set last_sweep = now() - interval '2 hours' where id = true`);

    const before = await withSystem((tx) => tx<{ last_sweep: Date }[]>`select last_sweep from maintenance where id = true`);

    const result = await checkDb();

    expect(result.ok).toBe(true);
    expect(result.schemaVersion).toBeNull(); // the lookup failed, as expected — but harmlessly

    const after = await withSystem((tx) => tx<{ last_sweep: Date }[]>`select last_sweep from maintenance where id = true`);
    expect(new Date(after[0]!.last_sweep).getTime()).toBeGreaterThan(new Date(before[0]!.last_sweep).getTime());
  });

  afterAll(async () => {
    await closePool();
  });
});
