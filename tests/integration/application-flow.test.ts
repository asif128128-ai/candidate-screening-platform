import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// TEST_STRATEGY.md §1/§4: integration tests against a real Postgres. This
// repo has no Docker/Supabase CLI (IMPLEMENTATION_NOTES.md), so this suite
// runs against `./scripts/local-pg-setup.sh screening_test` instead —
// requires DATABASE_URL to point at that database (and app_user's local
// password) before running: see `tests/integration/README.md` and
// `pnpm test:integration` note below. Skips itself (all green, no tests
// run) when DATABASE_URL isn't set, so `pnpm test` stays usable without a
// local Postgres for anyone only touching pure-function code.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";

describe.runIf(hasDb)("application-flow (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let submitPersonalDetails: typeof import("@/db/queries/application-flow").submitPersonalDetails;
  let getApplicationRoutingState: typeof import("@/db/queries/application-flow").getApplicationRoutingState;
  let confirmJobUnderstanding: typeof import("@/db/queries/application-flow").confirmJobUnderstanding;
  let recordMonitoringConsent: typeof import("@/db/queries/application-flow").recordMonitoringConsent;
  let resumeWithCode: typeof import("@/db/queries/application-flow").resumeWithCode;
  let requestOtp: typeof import("@/db/queries/application-flow").requestOtp;
  let verifyOtp: typeof import("@/db/queries/application-flow").verifyOtp;
  let createPrivacyRequest: typeof import("@/db/queries/application-flow").createPrivacyRequest;
  let consumeRateLimit: typeof import("@/lib/rate-limit").consumeRateLimit;
  let closePool: typeof import("@/db/postgres").closePool;

  // `app_user` (the role every app code path connects as) deliberately has
  // no DELETE grant on `jobs`/`privacy_requests` (DATA_MODEL.md §6.1) — that
  // restriction is exactly what this suite is implicitly verifying. Test
  // *cleanup* of rows in those two tables therefore needs a separate
  // connection with owner privileges (the local Postgres superuser, same as
  // `local-pg-setup.sh` connects as); `TEST_DB_SUPERUSER_URL` overrides it,
  // otherwise it's derived from DATABASE_URL with credentials stripped
  // (peer auth as the current OS user, matching the setup script).
  function deriveSuperuserUrl(): string {
    if (process.env.TEST_DB_SUPERUSER_URL) return process.env.TEST_DB_SUPERUSER_URL;
    const url = new URL(process.env.DATABASE_URL!);
    url.username = "";
    url.password = "";
    return url.toString();
  }
  // NOT created at describe-body scope: `describe.runIf(false)` still calls
  // this factory function to enumerate the (skipped) tests, so anything
  // that touches `process.env.DATABASE_URL` eagerly here would throw even
  // when `pnpm test` runs with no DB configured at all. Created in
  // `beforeAll` instead, which genuinely doesn't run for a skipped suite.
  let superuserSql: ReturnType<typeof postgres>;

  let jobSlug: string;
  let jobId: string;
  const createdCandidateEmails: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    superuserSql = postgres(deriveSuperuserUrl());
    ({ withSystem, closePool } = await import("@/db/postgres"));
    ({
      submitPersonalDetails,
      getApplicationRoutingState,
      confirmJobUnderstanding,
      recordMonitoringConsent,
      resumeWithCode,
      requestOtp,
      verifyOtp,
      createPrivacyRequest,
    } = await import("@/db/queries/application-flow"));
    ({ consumeRateLimit } = await import("@/lib/rate-limit"));

    jobSlug = `test-job-${randomUUID().slice(0, 8)}`;
    jobId = await withSystem(async (tx) => {
      const configRows = await tx<{ id: string }[]>`
        select id from assessment_configs where key = 'default_tech_student_v1' limit 1
      `;
      const configId = configRows[0]?.id;
      if (!configId) throw new Error("seed assessment_configs row missing — run 0002_seed.sql first");

      const rows = await tx<{ id: string }[]>`
        insert into jobs (
          slug, title_he, summary_he, description_he, description_html,
          hourly_rate_ils, hours_per_week, days_per_week, hours_per_day,
          location_he, hybrid_he, confirmations_he, response_window_days,
          is_active, assessment_config_id
        ) values (
          ${jobSlug}, 'משרת בדיקה', 'תקציר', 'תיאור', '<p>תיאור</p>',
          85, 18, 3, 6,
          'ראשון לציון', 'היברידי', ${JSON.stringify(["a", "b", "c"])}::jsonb, 14,
          true, ${configId}
        )
        returning id
      `;
      return rows[0]!.id;
    });
    createdJobIds.push(jobId);
  });

  afterAll(async () => {
    // DATA_MODEL.md §6.1: app_user has no direct DELETE on
    // candidates/applications — deletion only via the SECURITY DEFINER
    // `delete_candidate()` function (cascades its applications too, so
    // `createdApplicationIds` doesn't need a separate delete).
    const ids: string[] = [];
    for (const email of createdCandidateEmails) {
      const found = await withSystem(async (tx) => {
        const rows = await tx<{ id: string }[]>`select id from candidates where email = ${email}`;
        return rows[0]?.id ?? null;
      });
      if (found) ids.push(found);
    }
    // `applications.duplicate_phone_of` (no ON DELETE cascade) can point
    // from one test candidate to another, so deletion order matters. A
    // failed delete aborts its own transaction only (each attempt is its
    // own `withSystem` call) — retry in passes until nothing's left rather
    // than hand-sorting the dependency order.
    let remaining = ids;
    for (let pass = 0; pass < remaining.length + 1 && remaining.length > 0; pass++) {
      const stillFailing: string[] = [];
      for (const id of remaining) {
        try {
          await withSystem((tx) => tx`select delete_candidate(${id})`);
        } catch {
          stillFailing.push(id);
        }
      }
      remaining = stillFailing;
    }
    await withSystem((tx) => tx`delete from rate_limits where key like 'test-rl-%'`);
    // jobs/privacy_requests: no app_user DELETE grant either (admin-only
    // tables) — clean up via the superuser connection instead.
    for (const id of createdJobIds) {
      await superuserSql`delete from jobs where id = ${id}`;
    }
    await superuserSql`delete from privacy_requests where email like 'test-%@example.com'`;
    await superuserSql.end({ timeout: 5 });
    await closePool();
  });

  function uniqueEmail(): string {
    const email = `test-${randomUUID().slice(0, 12)}@example.com`;
    createdCandidateEmails.push(email);
    return email;
  }

  function baseInput(overrides: Partial<Parameters<typeof submitPersonalDetails>[0]> = {}) {
    return {
      jobSlug,
      firstName: "דנה",
      lastName: "כהן",
      dateOfBirth: new Date("2001-05-01"),
      phoneE164: `+97250${Math.floor(1000000 + Math.random() * 8999999)}`,
      emailNormalized: uniqueEmail(),
      institution: "הטכניון",
      degreeProgram: "מדעי המחשב",
      studyYear: 2,
      academicAverage: 88,
      canWorkRishon: true,
      linkedinUrl: null,
      githubUrl: null,
      pendingCv: null,
      ipPrefix: "1.2.3.0/24",
      userAgent: "vitest",
      ...overrides,
    };
  }

  it("creates a candidate + application on first submission", async () => {
    const input = baseInput();
    const result = await submitPersonalDetails(input);
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    createdApplicationIds.push(result.applicationId);
    expect(result.resumeCode).toHaveLength(8);
    expect(result.jobTitle).toBe("משרת בדיקה");
  });

  it("redirects to /resume for the same email + same job before completion", async () => {
    const input = baseInput();
    const first = await submitPersonalDetails(input);
    expect(first.kind).toBe("created");
    if (first.kind === "created") createdApplicationIds.push(first.applicationId);

    const second = await submitPersonalDetails(input);
    expect(second.kind).toBe("redirect_to_resume");
  });

  it("reports already_completed once the session is completed", async () => {
    const input = baseInput();
    const first = await submitPersonalDetails(input);
    if (first.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(first.applicationId);

    // Simulate a completed assessment session directly (assessment-engine's
    // domain; this test only needs the routing signal it produces).
    await withSystem(async (tx) => {
      const configRows = await tx<{ id: string }[]>`select id from assessment_configs limit 1`;
      await tx`
        insert into assessment_sessions (application_id, config_id, config_version, seed, status, total_items, expires_at, completed_at)
        values (${first.applicationId}, ${configRows[0]!.id}, 1, 42, 'completed', 27, now(), now())
      `;
    });

    const second = await submitPersonalDetails(input);
    expect(second.kind).toBe("already_completed");
  });

  it("allows the same email to apply to a different job, reusing the candidate row", async () => {
    const email = uniqueEmail();
    const first = await submitPersonalDetails(baseInput({ emailNormalized: email, firstName: "רון" }));
    if (first.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(first.applicationId);

    const otherJobSlug = `test-job-2-${randomUUID().slice(0, 8)}`;
    const otherJobId = await withSystem(async (tx) => {
      const configRows = await tx<{ id: string }[]>`select id from assessment_configs limit 1`;
      const rows = await tx<{ id: string }[]>`
        insert into jobs (
          slug, title_he, summary_he, description_he, description_html,
          confirmations_he, is_active, assessment_config_id, location_he
        ) values (
          ${otherJobSlug}, 'משרה שנייה', 'תקציר', 'תיאור', '<p>תיאור</p>',
          ${JSON.stringify(["a", "b", "c"])}::jsonb, true, ${configRows[0]!.id}, 'ראשון לציון'
        )
        returning id
      `;
      return rows[0]!.id;
    });
    createdJobIds.push(otherJobId);

    const second = await submitPersonalDetails(baseInput({ emailNormalized: email, jobSlug: otherJobSlug, firstName: "רון" }));
    expect(second.kind).toBe("created");
    if (second.kind === "created") createdApplicationIds.push(second.applicationId);
  });

  it("flags duplicate_phone_of for a different candidate sharing a phone number, without blocking", async () => {
    const phone = `+97252${Math.floor(1000000 + Math.random() * 8999999)}`;
    const first = await submitPersonalDetails(baseInput({ phoneE164: phone }));
    if (first.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(first.applicationId);

    const second = await submitPersonalDetails(baseInput({ phoneE164: phone }));
    expect(second.kind).toBe("created");
    if (second.kind !== "created") return;
    createdApplicationIds.push(second.applicationId);

    const dup = await withSystem(async (tx) => {
      const rows = await tx<{ duplicate_phone_of: string | null }[]>`
        select duplicate_phone_of from applications where id = ${second.applicationId}
      `;
      return rows[0]?.duplicate_phone_of ?? null;
    });
    expect(dup).not.toBeNull();
  });

  it("routes through job -> briefing as confirmations are recorded", async () => {
    const input = baseInput();
    const created = await submitPersonalDetails(input);
    if (created.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(created.applicationId);

    let state = await getApplicationRoutingState(created.applicationId);
    expect(state?.currentStep).toBe("job");

    await confirmJobUnderstanding(created.applicationId);
    state = await getApplicationRoutingState(created.applicationId);
    expect(state?.currentStep).toBe("briefing");
    expect(state?.jobConfirmedAt).not.toBeNull();

    await recordMonitoringConsent(created.applicationId, "1.2.3.0/24");
    state = await getApplicationRoutingState(created.applicationId);
    expect(state?.monitoringConsentGiven).toBe(true);
    // Consent alone doesn't start a session, so the step stays "briefing"
    // until the assessment-engine's start endpoint creates one.
    expect(state?.currentStep).toBe("briefing");
  });

  it("resumeWithCode finds the application by email + code and rejects a wrong code", async () => {
    const input = baseInput();
    const created = await submitPersonalDetails(input);
    if (created.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(created.applicationId);

    const codeDigits = created.resumeCode.replace("-", "");
    const found = await resumeWithCode(input.emailNormalized, codeDigits);
    expect(found.kind).toBe("found");
    if (found.kind === "found") expect(found.applicationId).toBe(created.applicationId);

    const notFound = await resumeWithCode(input.emailNormalized, "WRONGCODE");
    expect(notFound.kind).toBe("not_found");
  });

  it("OTP request + verify round trip, and rejects an expired code", async () => {
    const input = baseInput();
    const created = await submitPersonalDetails(input);
    if (created.kind !== "created") throw new Error("expected created");
    createdApplicationIds.push(created.applicationId);

    const requestResult = await requestOtp(input.emailNormalized);
    expect(requestResult.kind).toBe("sent");

    const storedHash = await withSystem(async (tx) => {
      const rows = await tx<{ otp_code_hash: Buffer | null }[]>`
        select otp_code_hash from applications where id = ${created.applicationId}
      `;
      return rows[0]?.otp_code_hash ?? null;
    });
    expect(storedHash).not.toBeNull();

    const wrongVerify = await verifyOtp(input.emailNormalized, "000000");
    expect(wrongVerify.kind).toBe("invalid");

    // Expire it directly to test the expiry path (can't wait 10 real minutes).
    await withSystem(async (tx) => {
      await tx`update applications set otp_expires_at = now() - interval '1 minute' where id = ${created.applicationId}`;
    });
    const expiredVerify = await verifyOtp(input.emailNormalized, "123456");
    expect(expiredVerify.kind).toBe("expired");
  });

  it("createPrivacyRequest inserts a row", async () => {
    const email = uniqueEmail();
    await createPrivacyRequest(email, "access", "test note");
    const row = await withSystem(async (tx) => {
      const rows = await tx<{ id: string }[]>`select id from privacy_requests where email = ${email}`;
      return rows[0];
    });
    expect(row).toBeDefined();
    // Cleaned up in afterAll via superuserSql (app_user has no DELETE grant
    // on privacy_requests — admin-only table, DATA_MODEL.md §6.1).
  });

  it("consumeRateLimit denies after the limit within the window", async () => {
    const key = `test-rl-${randomUUID().slice(0, 8)}`;
    const results: boolean[] = [];
    await withSystem(async (tx) => {
      for (let i = 0; i < 4; i++) {
        const { allowed } = await consumeRateLimit(tx, key, 3, 3600);
        results.push(allowed);
      }
    });
    expect(results).toEqual([true, true, true, false]);
  });
});
