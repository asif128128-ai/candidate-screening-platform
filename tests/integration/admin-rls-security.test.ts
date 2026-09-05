import "dotenv/config";
import { describe, test, expect, afterAll } from "vitest";
import { withCandidate, withAdmin, withSystem, closePool } from "@/db/postgres";

// TEST_STRATEGY.md §7 security boundary: "with app.context = 'candidate'
// ... SELECT FROM admin_users/admin_notes -> 0 rows"; "with no context set,
// every table returns 0 rows". This is the DB layer half of the task's
// required security-boundary test ("a non-admin/unauthenticated request
// cannot read candidate data through any admin route or API") — the
// Playwright half (tests/e2e/admin-security.spec.ts) proves the same thing
// through the actual HTTP surface; this proves it holds even if an admin
// route's application code forgot a WHERE clause entirely, which is
// exactly the defense-in-depth ARCHITECTURE.md §2 describes.
//
// Requires a reachable local Postgres (DATABASE_URL) — see
// IMPLEMENTATION_NOTES.md / ./scripts/local-pg-setup.sh. Skips itself
// (rather than failing) when DATABASE_URL isn't set, e.g. in CI, which has
// no Postgres available yet (TEST_STRATEGY.md §4 calls for Docker/Supabase
// local in CI; not wired up as of this build).
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("admin_application_rows RLS (security_invoker)", () => {
  afterAll(async () => {
    await closePool();
  });

  test("candidate context with an unrelated application_id sees zero admin rows", async () => {
    const rows = await withCandidate("00000000-0000-0000-0000-000000000000", (tx) =>
      tx`select count(*) from admin_application_rows`,
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });

  test("candidate context cannot read admin_users or admin_notes at all", async () => {
    const [users, notes] = await withCandidate("00000000-0000-0000-0000-000000000000", (tx) =>
      Promise.all([
        tx`select count(*) from admin_users`,
        tx`select count(*) from admin_notes`,
      ]),
    );
    expect(Number(users[0]?.count)).toBe(0);
    expect(Number(notes[0]?.count)).toBe(0);
  });

  test("admin context with an unknown/disabled admin id sees zero rows", async () => {
    const rows = await withAdmin("00000000-0000-0000-0000-000000000000", (tx) =>
      tx`select count(*) from admin_application_rows`,
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });

  test("admin context with a real, enabled admin id sees rows (the view is not just permanently broken)", async () => {
    const [admin] = await withSystem((tx) =>
      tx<{ id: string }[]>`select id from admin_users where disabled_at is null limit 1`,
    );
    // If dev-seed.sql hasn't been run there's nothing to assert against —
    // skip rather than fail, this test's purpose is the negative case above.
    if (!admin) return;
    const rows = await withAdmin(admin.id, (tx) => tx`select count(*) from admin_application_rows`);
    expect(Number(rows[0]?.count)).toBeGreaterThan(0);
  });

  test("app_user cannot bypass RLS via the view even with no context set at all", async () => {
    // withSystem still sets app.context = 'system', which the policies
    // treat as full access (boot/sweep code) — to test the true "nothing
    // set" case we go around the withX helpers with a raw one-off
    // connection that never calls set_config.
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      const rows = await sql`select count(*) from admin_application_rows`;
      expect(Number(rows[0]?.count)).toBe(0);
    } finally {
      await sql.end();
    }
  });
});
