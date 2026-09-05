import "dotenv/config";
import { randomUUID } from "node:crypto";
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

  // Red-team finding #3 (CRITICAL): `email_outbox_any`/`rate_limit_any`
  // (0001_init.sql) used to grant `candidate` context unrestricted
  // read/write over the *entire* table — a connection in `candidate`
  // context (the same context every candidate-facing request uses) could
  // read every application's `resume_otp` email row (plaintext OTP login
  // codes) and delete/modify any `rate_limits` row (e.g. another
  // applicant's lockout). Fixed in
  // supabase/migrations/0009_scope_outbox_ratelimit_rls.sql by scoping both
  // policies to `system`/`admin` only (no legitimate `candidate`-context
  // code path touches either table directly — see that migration's
  // comment for the grep that established this).
  test("candidate context cannot read another application's email_outbox row (e.g. a resume_otp code)", async () => {
    // Any real application_id works to prove the point (the row belongs to
    // "someone else" from the perspective of the candidate context used
    // below, which has no application at all); the seeded job's config
    // isn't needed since email_outbox.application_id merely needs to
    // reference a real row to satisfy its FK — use the DB-owner connection
    // to insert directly rather than depending on other tests' fixtures.
    const [job] = await withSystem((tx) => tx<{ id: string }[]>`select id from jobs limit 1`);
    let otherAppId: string | null = null;
    let otherCandidateId: string | null = null;
    if (job) {
      const [candidate] = await withSystem(
        (tx) => tx<{ id: string }[]>`
          insert into candidates (email, phone_e164, first_name, last_name, date_of_birth,
            institution, degree_program, study_year, academic_average)
          values (${`otbx-${randomUUID()}@example.com`}, '+972500000099', 'בדיקה', 'בדיקה', '2000-01-01',
            'מוסד', 'תואר', 2, 85)
          returning id
        `,
      );
      otherCandidateId = candidate!.id;
      const [application] = await withSystem(
        (tx) => tx<{ id: string }[]>`
          insert into applications (candidate_id, job_id, can_work_rishon, resume_code_hash)
          values (${candidate!.id}, ${job.id}, true, digest(${randomUUID()}, 'sha256'))
          returning id
        `,
      );
      otherAppId = application!.id;
    }
    await withSystem(
      (tx) => tx`
        insert into email_outbox (to_email, template, payload, application_id)
        values ('victim@example.com', 'resume_otp', ${tx.json({ code: "SECRET1" })}, ${otherAppId})
      `,
    );
    try {
      // Candidate context has no access to email_outbox at all (no
      // legitimate candidate-facing code path needs it — see
      // 0009_scope_outbox_ratelimit_rls.sql) — not even to a row created
      // for its own application_id.
      const rows = await withCandidate(otherAppId ?? randomUUID(), (tx) => tx`select count(*) from email_outbox`);
      expect(Number(rows[0]?.count)).toBe(0);
    } finally {
      await withSystem((tx) => tx`delete from email_outbox where to_email = 'victim@example.com'`);
      if (otherCandidateId) await withSystem((tx) => tx`select delete_candidate(${otherCandidateId}::uuid)`);
    }
  });

  test("candidate context cannot read or delete an arbitrary rate_limits row", async () => {
    const key = `signup:test-${randomUUID()}`;
    await withSystem((tx) => tx`insert into rate_limits (key, tokens, refilled_at) values (${key}, 5, now())`);
    try {
      const rows = await withCandidate(randomUUID(), (tx) => tx`select count(*) from rate_limits where key = ${key}`);
      expect(Number(rows[0]?.count)).toBe(0);

      // Attempting to clear another applicant's lockout by deleting their
      // rate_limits row must silently affect zero rows under RLS, not throw
      // — this is the exact "remove another applicant's lockout" attack the
      // finding named.
      await withCandidate(randomUUID(), (tx) => tx`delete from rate_limits where key = ${key}`);
      const stillThere = await withSystem((tx) => tx`select count(*) from rate_limits where key = ${key}`);
      expect(Number(stillThere[0]?.count)).toBe(1);
    } finally {
      await withSystem((tx) => tx`delete from rate_limits where key = ${key}`);
    }
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
