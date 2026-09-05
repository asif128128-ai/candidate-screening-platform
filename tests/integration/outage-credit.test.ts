import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

// Red-team finding #4 (CRITICAL, data-integrity, cross-process):
// `apply_outage_credit()` was not idempotent across multiple server
// processes calling it with the same (or overlapping) outage window —
// verified in production-like conditions to double-credit an item (60s of
// credit against a 30s time_limit_s). Fixed in
// supabase/migrations/0010_outage_credit_idempotent.sql: a
// `pg_advisory_xact_lock` serializes concurrent calls, and a per-item
// `not exists` guard against already-recorded overlapping `server_outage`
// integrity_events rows makes a repeat (or overlapping) call over the same
// window a no-op. This suite calls the SQL function directly, twice, with
// the exact same window, and asserts the second call credits nothing.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

describe.runIf(hasDb)("apply_outage_credit() idempotency (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let closePool: typeof import("@/db/postgres").closePool;

  let jobId: string;
  let candidateId: string;
  let applicationId: string;
  let sessionId: string;
  let itemId: string;

  it("setup: one candidate + application + session + one live item", async () => {
    ({ withSystem, closePool } = await import("@/db/postgres"));

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
          ${`test-outage-${randomUUID().slice(0, 8)}`}, 'משרת בדיקה', 'תקציר', 'תיאור', '<p>תיאור</p>',
          'ראשון לציון', ${JSON.stringify(["a", "b", "c"])}::jsonb, true, ${configId}
        )
        returning id
      `;
      return rows[0]!.id;
    });

    await withSystem(async (tx) => {
      const [candidate] = await tx<{ id: string }[]>`
        insert into candidates (email, phone_e164, first_name, last_name, date_of_birth,
          institution, degree_program, study_year, academic_average)
        values (${`outage-${randomUUID()}@example.com`}, '+972500000077', 'בדיקה', 'בדיקה', '2000-01-01',
          'מוסד', 'תואר', 2, 85)
        returning id
      `;
      candidateId = candidate!.id;
      const [application] = await tx<{ id: string }[]>`
        insert into applications (candidate_id, job_id, can_work_rishon, resume_code_hash)
        values (${candidateId}, ${jobId}, true, digest(${randomUUID()}, 'sha256'))
        returning id
      `;
      applicationId = application!.id;
      const configRows = await tx<{ id: string; blueprint: unknown }[]>`
        select id from assessment_configs where key = 'default_tech_student_v1' limit 1
      `;
      const [session] = await tx<{ id: string }[]>`
        insert into assessment_sessions (application_id, config_id, config_version, seed, total_items, expires_at)
        values (${applicationId}, ${configRows[0]!.id}, 1, 1, 27, now() + interval '75 minutes')
        returning id
      `;
      sessionId = session!.id;

      // A 30s-time-limit item, served 20s ago (so its deadline is 10s in the
      // future) — squarely "live" and eligible for outage credit.
      const [item] = await tx<{ id: string }[]>`
        insert into assessment_items (
          session_id, position, block_key, pillar, template_id, template_version,
          variant_seed, kind, difficulty, time_limit_s, status, served_at, deadline_at, serve_nonce
        ) values (
          ${sessionId}, 1, 'speed', 'speed', 'test.template', 1,
          1, 'single_choice', 1, 30, 'served', now() - interval '20 seconds', now() + interval '10 seconds', gen_random_bytes(16)
        )
        returning id
      `;
      itemId = item!.id;
    });

    expect(itemId).toBeTruthy();
  });

  it("crediting the same window twice only credits the item once (second call is a no-op)", async () => {
    const windowStart = new Date(Date.now() - 60_000);
    const windowEnd = new Date(Date.now() + 20_000); // covers the item's whole remaining window (deadline +10s), saturating the time_limit_s cap

    const [first] = await withSystem((tx) =>
      tx<{ apply_outage_credit: number }[]>`select apply_outage_credit(${windowStart}, ${windowEnd})`,
    );
    expect(first!.apply_outage_credit).toBe(1);

    const afterFirst = await withSystem((tx) =>
      tx<{ outage_credit_ms: number; deadline_at: Date }[]>`
        select outage_credit_ms, deadline_at from assessment_items where id = ${itemId}
      `,
    );
    expect(afterFirst[0]!.outage_credit_ms).toBe(30_000); // capped at time_limit_s

    const eventsAfterFirst = await withSystem((tx) =>
      tx<{ count: string }[]>`
        select count(*)::text as count from integrity_events where item_id = ${itemId} and kind = 'server_outage'
      `,
    );
    expect(Number(eventsAfterFirst[0]!.count)).toBe(1);

    // Exact same window, called again (e.g. a second process racing the boot check).
    const [second] = await withSystem((tx) =>
      tx<{ apply_outage_credit: number }[]>`select apply_outage_credit(${windowStart}, ${windowEnd})`,
    );
    expect(second!.apply_outage_credit).toBe(0); // no-op: zero additional items credited

    const afterSecond = await withSystem((tx) =>
      tx<{ outage_credit_ms: number }[]>`select outage_credit_ms from assessment_items where id = ${itemId}`,
    );
    expect(afterSecond[0]!.outage_credit_ms).toBe(30_000); // unchanged — NOT doubled to 60_000

    const eventsAfterSecond = await withSystem((tx) =>
      tx<{ count: string }[]>`
        select count(*)::text as count from integrity_events where item_id = ${itemId} and kind = 'server_outage'
      `,
    );
    expect(Number(eventsAfterSecond[0]!.count)).toBe(1); // zero additional integrity events
  });

  afterAll(async () => {
    if (candidateId) await withSystem((tx) => tx`select delete_candidate(${candidateId}::uuid)`).catch(() => {});
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
