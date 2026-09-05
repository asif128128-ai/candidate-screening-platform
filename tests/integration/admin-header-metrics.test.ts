import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

// Fable's final holistic review (IMPLEMENTATION_STATE.md "Fable's final
// holistic review — two fixes") found two "fake precision" bugs in the
// admin candidate list, both stemming from the same root cause: counting or
// ranking applications that were never promised a score or a reply.
//
// 1. admin_application_rows.pct_rank (0001_init.sql) used to compute
//    percent_rank() over EVERY application in the job, including ones with
//    no assessment_results row at all (never started/finished). With
//    typical drop-off, those unscored rows piled up at the bottom and
//    inflated everyone else's percentile — the "מובילים" (top 10%) filter
//    was showing roughly the top quarter of *completers*, not the top 10%
//    of test-takers. Fixed by 0012_pct_rank_scored_only.sql: pct_rank is
//    now computed only among applications with a real score, and is null
//    otherwise.
// 2. getHeaderCounts()'s "overdue" metric (src/db/queries/candidates.ts)
//    used to count every non-rejected/hired application aged past the
//    response window from raw *application* time — including candidates
//    who never even started the assessment. The reply-by-date promise
//    (DECISIONS_LOG #3) is only made on the done page, after finishing the
//    assessment, so those rows were never actually owed anything and the
//    counter would become permanent noise at any real drop-off rate. Fixed
//    by scoping the count to 'assessment_completed'/'under_review' stages.
//
// Both proven here against a real local Postgres, not by reading the SQL.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

describe.runIf(hasDb)("admin header metrics: pct_rank and overdue (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let withAdmin: typeof import("@/db/postgres").withAdmin;
  let closePool: typeof import("@/db/postgres").closePool;
  let getHeaderCounts: typeof import("@/db/queries/candidates").getHeaderCounts;

  let jobId: string;
  let adminId: string;
  const createdCandidateIds: string[] = [];

  async function makeCandidate(opts: {
    stage: string;
    createdAt: string; // interval literal, e.g. "now() - interval '20 days'"
    scored: boolean;
  }): Promise<string> {
    return withSystem(async (tx) => {
      const email = `metrics-${randomUUID()}@example.com`;
      const [candidate] = await tx<{ id: string }[]>`
        insert into candidates (email, phone_e164, first_name, last_name, date_of_birth,
          institution, degree_program, study_year, academic_average)
        values (${email}, ${`+9725${Math.floor(10000000 + Math.random() * 89999999)}`}, 'בדיקה', 'בדיקה', '2000-01-01',
          'מוסד בדיקה', 'תואר בדיקה', 2, 85)
        returning id
      `;
      const candidateId = candidate!.id;
      const [application] = await tx<{ id: string }[]>`
        insert into applications (candidate_id, job_id, stage, can_work_rishon, resume_code_hash, created_at)
        values (${candidateId}, ${jobId}, ${opts.stage}, true, digest(${randomUUID()}, 'sha256'),
          now() - (${opts.createdAt})::interval)
        returning id
      `;
      const applicationId = application!.id;
      if (opts.scored) {
        const configRows = await tx<{ id: string }[]>`
          select id from assessment_configs where key = 'default_tech_student_v1' limit 1
        `;
        const [session] = await tx<{ id: string }[]>`
          insert into assessment_sessions (application_id, config_id, config_version, seed, status,
            total_items, started_at, expires_at, completed_at)
          values (${applicationId}, ${configRows[0]!.id}, 1, 1, 'completed', 27, now(),
            now() + interval '75 minutes', now())
          returning id
        `;
        await tx`
          insert into assessment_results (session_id, application_id, job_id, scoring_version,
            score_overall, score_reasoning, score_independence, score_tech, score_speed, confidence,
            items_answered, items_expired, items_correct, integrity_risk, integrity_score,
            integrity_reasons, breakdown)
          values (${session!.id}, ${applicationId}, ${jobId}, 1,
            ${50 + Math.random() * 40}, 70, 70, 70, 70, 0.8,
            27, 0, 20, 'low', 5,
            '[]'::jsonb, '{}'::jsonb)
        `;
      }
      return candidateId;
    });
  }

  afterAll(async () => {
    if (!hasDb) return;
    // Direct DELETE on applications/jobs isn't granted to app_user (only
    // delete_candidate()/delete_application() are, per DATA_MODEL.md §6) —
    // same cleanup pattern as candidate-delete.test.ts.
    for (const id of createdCandidateIds) {
      await withSystem((tx) => tx`select delete_candidate(${id}::uuid)`).catch(() => {});
    }
    if (adminId) {
      await withSystem((tx) => tx`delete from admin_users where id = ${adminId}`).catch(() => {});
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

  it("setup: a test job and admin exist", async () => {
    ({ withSystem, withAdmin, closePool } = await import("@/db/postgres"));
    ({ getHeaderCounts } = await import("@/db/queries/candidates"));

    jobId = await withSystem(async (tx) => {
      const configRows = await tx<{ id: string }[]>`
        select id from assessment_configs where key = 'default_tech_student_v1' limit 1
      `;
      const configId = configRows[0]?.id;
      if (!configId) throw new Error("seed assessment_configs row missing — run 0002_seed.sql first");
      const rows = await tx<{ id: string }[]>`
        insert into jobs (
          slug, title_he, summary_he, description_he, description_html,
          location_he, confirmations_he, response_window_days, is_active, assessment_config_id
        ) values (
          ${`test-metrics-job-${randomUUID().slice(0, 8)}`}, 'משרת בדיקה', 'תקציר', 'תיאור', '<p>תיאור</p>',
          'ראשון לציון', ${JSON.stringify(["a", "b", "c"])}::jsonb, 14, true, ${configId}
        )
        returning id
      `;
      return rows[0]!.id;
    });

    adminId = await withSystem(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into admin_users (email, display_name)
        values (${`metrics-admin-${randomUUID()}@example.co.il`}, 'בדיקה')
        returning id
      `;
      return row!.id;
    });

    expect(jobId).toBeTruthy();
    expect(adminId).toBeTruthy();
  });

  it("pct_rank is null for unscored applications and reflects rank only among scored ones", async () => {
    const unscored = await makeCandidate({ stage: "applied", createdAt: "'1 hour'", scored: false });
    const inProgress = await makeCandidate({ stage: "assessment_started", createdAt: "'1 hour'", scored: false });
    const lowScorer = await makeCandidate({ stage: "assessment_completed", createdAt: "'1 hour'", scored: true });
    createdCandidateIds.push(unscored, inProgress, lowScorer);

    const rows = await withSystem((tx) =>
      tx<{ candidate_id: string; pct_rank: number | null; score_overall: string | null }[]>`
        select candidate_id, pct_rank, score_overall from admin_application_rows
        where job_id = ${jobId}
        order by pct_rank nulls last
      `,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.candidate_id, r]));

    // Before the fix, these two would have carried a non-null pct_rank
    // (percent_rank() ranked them alongside scored rows via "nulls first"
    // score ordering) and would have dragged every real score's percentile
    // upward. Now they must be null — never shown as a percentile at all.
    expect(byId[unscored]?.pct_rank).toBeNull();
    expect(byId[inProgress]?.pct_rank).toBeNull();
    // The one scored row in this isolated job is, by definition, both the
    // top and bottom of its own scored population.
    expect(byId[lowScorer]?.pct_rank).not.toBeNull();
  });

  it("overdue count excludes applied/assessment_started rows aged past the response window, even though they're non-terminal", async () => {
    // Before the fix: this alone would have counted as 1 overdue reply,
    // despite the candidate never finishing the assessment and never being
    // shown a reply-by promise anywhere in the product.
    const abandonedLongAgo = await makeCandidate({
      stage: "applied",
      createdAt: "'30 days'",
      scored: false,
    });
    createdCandidateIds.push(abandonedLongAgo);

    const countsBeforeGenuineOverdue = await withAdmin(adminId, (tx) => getHeaderCounts(tx, jobId));
    expect(countsBeforeGenuineOverdue.overdue).toBe(0);

    // A genuinely finished-but-unreplied-to candidate, aged past the
    // window, must still be counted — this proves the fix narrows the
    // population correctly rather than breaking the metric entirely.
    const genuinelyOverdue = await makeCandidate({
      stage: "assessment_completed",
      createdAt: "'30 days'",
      scored: true,
    });
    createdCandidateIds.push(genuinelyOverdue);

    const countsAfter = await withAdmin(adminId, (tx) => getHeaderCounts(tx, jobId));
    expect(countsAfter.overdue).toBe(1);
  });
});
