import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

// Red-team finding #1 (CRITICAL): `applications.duplicate_phone_of` had no
// `ON DELETE` action, so `delete_candidate()` raised an unhandled foreign-key
// violation whenever the candidate being deleted was referenced as *someone
// else's* duplicate-phone flag. That poisoned `prune_retention()` ->
// `run_maintenance_sweep()` -> `/api/health` (see health.test.ts for that
// half) and silently broke the admin bulk-archive-and-delete feature (any
// batch containing such a candidate rolled back entirely).
//
// Fixed by supabase/migrations/0008_duplicate_phone_of_fk_fix.sql (ON DELETE
// SET NULL) plus per-row savepoint isolation in `bulkArchiveAndDeleteAction`
// (src/app/admin/(protected)/candidates/actions.ts). This suite proves both
// halves against a real local Postgres.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

describe.runIf(hasDb)("delete_candidate() and duplicate_phone_of (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let withAdmin: typeof import("@/db/postgres").withAdmin;
  let closePool: typeof import("@/db/postgres").closePool;
  let deleteCandidate: typeof import("@/db/queries/candidate-mutations").deleteCandidate;

  let jobId: string;
  const createdCandidateIds: string[] = [];
  const createdAdminIds: string[] = [];

  async function makeCandidateWithApplication(opts: {
    email: string;
    phone: string;
    duplicatePhoneOf?: string | null;
  }): Promise<{ candidateId: string; applicationId: string }> {
    return withSystem(async (tx) => {
      const [candidate] = await tx<{ id: string }[]>`
        insert into candidates (email, phone_e164, first_name, last_name, date_of_birth,
          institution, degree_program, study_year, academic_average)
        values (${opts.email}, ${opts.phone}, 'בדיקה', 'בדיקה', '2000-01-01',
          'מוסד בדיקה', 'תואר בדיקה', 2, 85)
        returning id
      `;
      const candidateId = candidate!.id;
      const [application] = await tx<{ id: string }[]>`
        insert into applications (candidate_id, job_id, can_work_rishon, resume_code_hash, duplicate_phone_of)
        values (${candidateId}, ${jobId}, true, digest(${randomUUID()}, 'sha256'), ${opts.duplicatePhoneOf ?? null})
        returning id
      `;
      return { candidateId, applicationId: application!.id };
    });
  }

  it("setup: a test job exists", async () => {
    ({ withSystem, withAdmin, closePool } = await import("@/db/postgres"));
    ({ deleteCandidate } = await import("@/db/queries/candidate-mutations"));

    jobId = await withSystem(async (tx) => {
      const configRows = await tx<{ id: string }[]>`
        select id from assessment_configs where key = 'default_tech_student_v1' limit 1
      `;
      const configId = configRows[0]?.id;
      if (!configId) throw new Error("seed assessment_configs row missing — run 0002_seed.sql first");
      const rows = await tx<{ id: string }[]>`
        insert into jobs (
          slug, title_he, summary_he, description_he, description_html,
          location_he, confirmations_he, is_active, assessment_config_id
        ) values (
          ${`test-job-${randomUUID().slice(0, 8)}`}, 'משרת בדיקה', 'תקציר', 'תיאור', '<p>תיאור</p>',
          'ראשון לציון', ${JSON.stringify(["a", "b", "c"])}::jsonb, true, ${configId}
        )
        returning id
      `;
      return rows[0]!.id;
    });
    expect(jobId).toBeTruthy();
  });

  it("delete_candidate() succeeds on a candidate referenced by another application's duplicate_phone_of, and clears that reference", async () => {
    const { candidateId: referencedId } = await makeCandidateWithApplication({
      email: `ref-${randomUUID()}@example.com`,
      phone: "+972500000001",
    });
    const { candidateId: referencingCandidateId, applicationId: referencingAppId } = await makeCandidateWithApplication({
      email: `dup-${randomUUID()}@example.com`,
      phone: "+972500000001",
      duplicatePhoneOf: referencedId,
    });
    // referencedId is deleted by the assertion itself below; referencingCandidateId
    // never gets deleted in this test (only its duplicate_phone_of column is
    // cleared) — track it for cleanup too, or it leaks into the shared DB.
    createdCandidateIds.push(referencingCandidateId);

    // Before the fix, this threw a foreign-key violation
    // ("update or delete on table candidates violates foreign key
    // constraint applications_duplicate_phone_of_fkey").
    await expect(withSystem((tx) => tx`select delete_candidate(${referencedId}::uuid)`)).resolves.toBeDefined();

    const [row] = await withSystem((tx) =>
      tx<{ duplicate_phone_of: string | null }[]>`
        select duplicate_phone_of from applications where id = ${referencingAppId}
      `,
    );
    expect(row?.duplicate_phone_of).toBeNull();

    const [candidateRow] = await withSystem((tx) =>
      tx<{ id: string }[]>`select id from candidates where id = ${referencedId}`,
    );
    expect(candidateRow).toBeUndefined();
  });

  it("bulk-delete-style per-row isolation: a failing row's savepoint rolls back only that row, not the whole batch", async () => {
    const good1 = await makeCandidateWithApplication({ email: `good1-${randomUUID()}@example.com`, phone: "+972500000002" });
    const good2 = await makeCandidateWithApplication({ email: `good2-${randomUUID()}@example.com`, phone: "+972500000003" });
    // good1's delete is expected to succeed *during this test* (see the
    // assertions below), so only good2 (whose delete is expected to fail
    // and roll back) needs afterAll cleanup — tracked once, here, rather
    // than tracking both and untracking good1 later (mutating the shared
    // `createdCandidateIds` array via `.length = 0` previously wiped out
    // the *other* test's entry too, since it's shared across every `it` in
    // this describe block — a real leak this fix also closes).
    createdCandidateIds.push(good2.candidateId);

    const realAdminId = randomUUID();
    await withSystem((tx) =>
      tx`insert into admin_users (id, email, display_name) values (${realAdminId}, ${`admin-${randomUUID()}@example.com`}, 'בודק/ת')`,
    );
    createdAdminIds.push(realAdminId);
    const bogusAdminId = randomUUID(); // not a real admin_users row -> admin_audit_log FK violation

    const results: { id: string; ok: boolean }[] = [];
    await withAdmin(realAdminId, async (tx) => {
      // Mirrors bulkArchiveAndDeleteAction's per-row savepoint loop
      // (src/app/admin/(protected)/candidates/actions.ts).
      for (const [id, adminIdToUse] of [
        [good1.candidateId, realAdminId],
        [good2.candidateId, bogusAdminId], // forces deleteCandidate's audit-log insert to fail
      ] as const) {
        try {
          await tx.savepoint((sp) => deleteCandidate(sp, id, adminIdToUse));
          results.push({ id, ok: true });
        } catch {
          results.push({ id, ok: false });
        }
      }
      // Proves the transaction itself is still healthy after the failed
      // savepoint (not aborted) — a normal query still works and this
      // outer transaction still commits normally on return.
      const stillAlive = await tx`select 1 as one`;
      expect(stillAlive[0]?.one).toBe(1);
    });

    expect(results).toEqual([
      { id: good1.candidateId, ok: true },
      { id: good2.candidateId, ok: false },
    ]);

    const remaining = await withSystem((tx) =>
      tx<{ id: string }[]>`select id from candidates where id = any(${[good1.candidateId, good2.candidateId]}::uuid[])`,
    );
    // good1 deleted (its savepoint committed), good2 NOT deleted (its
    // savepoint was rolled back when the audit-log insert failed) —
    // i.e. one bad row did not silently take out the other row's delete.
    expect(remaining.map((r) => r.id)).toEqual([good2.candidateId]);
  });

  afterAll(async () => {
    for (const id of createdCandidateIds) {
      await withSystem((tx) => tx`select delete_candidate(${id}::uuid)`).catch(() => {});
    }
    for (const id of createdAdminIds) {
      await withSystem((tx) => tx`delete from admin_users where id = ${id}`).catch(() => {});
    }
    if (jobId) {
      const superuser = (await import("postgres")).default(
        process.env.TEST_DB_SUPERUSER_URL ??
          (() => {
            const url = new URL(process.env.DATABASE_URL!);
            url.username = "";
            url.password = "";
            return url.toString();
          })(),
      );
      await superuser`delete from jobs where id = ${jobId}`.catch(() => {});
      await superuser.end();
    }
    await closePool();
  });
});
