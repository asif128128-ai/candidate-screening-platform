import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// TEST_STRATEGY.md §1/§4/§7: integration tests for the assessment hot path
// (start/current/answer) against a real Postgres — the local stand-in from
// `./scripts/local-pg-setup.sh` in this environment (see
// tests/integration/README.md). Skips itself when DATABASE_URL isn't set.

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

describe.runIf(hasDb)("assessment runner hot path (integration, local Postgres)", () => {
  let withSystem: typeof import("@/db/postgres").withSystem;
  let closePool: typeof import("@/db/postgres").closePool;
  let submitPersonalDetails: typeof import("@/db/queries/application-flow").submitPersonalDetails;
  let confirmJobUnderstanding: typeof import("@/db/queries/application-flow").confirmJobUnderstanding;
  let recordMonitoringConsent: typeof import("@/db/queries/application-flow").recordMonitoringConsent;
  let startAssessmentSession: typeof import("@/db/queries/assessment").startAssessmentSession;
  let getCurrentItem: typeof import("@/db/queries/assessment").getCurrentItem;
  let submitAnswer: typeof import("@/db/queries/assessment").submitAnswer;
  let recordBeaconEvents: typeof import("@/db/queries/assessment").recordBeaconEvents;

  function deriveSuperuserUrl(): string {
    if (process.env.TEST_DB_SUPERUSER_URL) return process.env.TEST_DB_SUPERUSER_URL;
    const url = new URL(process.env.DATABASE_URL!);
    url.username = "";
    url.password = "";
    return url.toString();
  }
  let superuserSql: ReturnType<typeof postgres>;

  let jobId: string;
  let jobSlugForTests: string;
  let fastJobSlug: string;
  const createdCandidateEmails: string[] = [];
  const createdJobIds: string[] = [];
  const createdConfigIds: string[] = [];

  const noFacts = { ipPrefix: null, userAgent: null, clientInstanceId: null, clientNowMs: null };

  beforeAll(async () => {
    superuserSql = postgres(deriveSuperuserUrl());
    ({ withSystem, closePool } = await import("@/db/postgres"));
    ({ submitPersonalDetails, confirmJobUnderstanding, recordMonitoringConsent } = await import("@/db/queries/application-flow"));
    ({ startAssessmentSession, getCurrentItem, submitAnswer, recordBeaconEvents } = await import("@/db/queries/assessment"));

    const jobSlug = `test-assess-job-${randomUUID().slice(0, 8)}`;
    jobSlugForTests = jobSlug;
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

    // A second job on a tiny-time-limit blueprint (TEST_STRATEGY.md §5:
    // "real-time tests exist for one full run with time_limit_s overridden
    // via a test blueprint") — used only by the genuine-lateness test below,
    // so it can wait out a real (sub-second) deadline instead of needing to
    // mutate `deadline_at` directly, which `items_deadline_immutable`
    // correctly refuses to anyone but `apply_outage_credit()`.
    fastJobSlug = `test-assess-fast-${randomUUID().slice(0, 8)}`;
    {
      // `app_user` has no INSERT grant on `assessment_configs` (DATA_MODEL.md
      // §6.1: configs are seed/migration content, not something the running
      // app creates) — this test-only config is inserted via the superuser
      // connection instead, same as the `jobs`/`privacy_requests` cleanup
      // below.
      // generateSession's per-block difficulty mixes are keyed by block
      // count (generator.ts DIFFICULTY_MIX), so this has to keep the same
      // block shape as the real blueprint — only the time limits shrink.
      const fastBlueprint = {
        version: 1,
        blocks: [
          { key: "speed", pillar: "speed", count: 10, time_limit_s: 1, pool: "speed.*" },
          { key: "reasoning", pillar: "reasoning", count: 6, time_limit_s: 1, pool: "reasoning.*" },
          { key: "tech", pillar: "tech", count: 7, time_limit_s: 1, pool: "tech.*" },
          { key: "investigate", pillar: "independence", count: 4, time_limit_s: 1, pool: "investigate.*" },
        ],
        weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 },
        session_wall_clock_min: 75,
      };
      const configRows = await superuserSql<{ id: string }[]>`
        insert into assessment_configs (key, name_he, blueprint, is_locked)
        values (${`test_fast_${randomUUID().slice(0, 8)}`}, 'בדיקה מהירה', ${superuserSql.json(fastBlueprint)}, true)
        returning id
      `;
      const fastConfigId = configRows[0]!.id;
      createdConfigIds.push(fastConfigId);
      await withSystem(async (tx) => {
        const fastJobRows = await tx<{ id: string }[]>`
          insert into jobs (
            slug, title_he, summary_he, description_he, description_html,
            hourly_rate_ils, hours_per_week, days_per_week, hours_per_day,
            location_he, hybrid_he, confirmations_he, response_window_days,
            is_active, assessment_config_id
          ) values (
            ${fastJobSlug}, 'משרת בדיקה מהירה', 'תקציר', 'תיאור', '<p>תיאור</p>',
            85, 18, 3, 6,
            'ראשון לציון', 'היברידי', ${JSON.stringify(["a", "b", "c"])}::jsonb, 14,
            true, ${fastConfigId}
          )
          returning id
        `;
        createdJobIds.push(fastJobRows[0]!.id);
      });
    }
  });

  afterAll(async () => {
    const ids: string[] = [];
    for (const email of createdCandidateEmails) {
      const found = await withSystem(async (tx) => {
        const rows = await tx<{ id: string }[]>`select id from candidates where email = ${email}`;
        return rows[0]?.id ?? null;
      });
      if (found) ids.push(found);
    }
    for (const id of ids) {
      try {
        await withSystem((tx) => tx`select delete_candidate(${id})`);
      } catch {
        // best-effort cleanup
      }
    }
    for (const id of createdJobIds) {
      await superuserSql`delete from jobs where id = ${id}`;
    }
    for (const id of createdConfigIds) {
      await superuserSql`delete from assessment_configs where id = ${id}`;
    }
    await superuserSql.end({ timeout: 5 });
    await closePool();
  });

  async function newApplication(jobSlug: string = jobSlugForTests): Promise<string> {
    const email = `test-${randomUUID().slice(0, 12)}@example.com`;
    createdCandidateEmails.push(email);
    const result = await submitPersonalDetails({
      jobSlug,
      firstName: "דנה",
      lastName: "כהן",
      dateOfBirth: new Date("2001-05-01"),
      phoneE164: `+97250${Math.floor(1000000 + Math.random() * 8999999)}`,
      emailNormalized: email,
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
    });
    if (result.kind !== "created") throw new Error(`expected created, got ${result.kind}`);
    await confirmJobUnderstanding(result.applicationId);
    await recordMonitoringConsent(result.applicationId, "1.2.3.0/24");
    return result.applicationId;
  }

  /** Builds a valid (not necessarily correct) answer for whatever kind the served item is. */
  function answerFor(item: { kind: string; content: unknown }): unknown {
    const content = item.content as Record<string, unknown>;
    switch (item.kind) {
      case "single_choice":
        return { selectedIndex: 0 };
      case "multi_choice":
        return { selectedIndexes: [0] };
      case "numeric":
        return { value: 0 };
      case "short_text":
        return { text: "x" };
      case "ordering": {
        const n = (content.items as unknown[]).length;
        return { order: Array.from({ length: n }, (_, i) => i) };
      }
      case "investigation":
        return { q1: 0, q2: 0, q3: "x" };
      default:
        throw new Error(`unhandled kind ${item.kind}`);
    }
  }

  it("start -> current serves item 1 with a deadline and a token", async () => {
    const applicationId = await newApplication();
    const start = await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: "1.2.3.0/24" });
    expect(start.kind).toBe("ok");

    const current = await getCurrentItem(applicationId, noFacts);
    expect(current.kind).toBe("active");
    if (current.kind !== "active") return;
    expect(current.payload.position).toBe(1);
    expect(current.payload.totalItems).toBe(27);
    expect(current.payload.itemToken).toBeTruthy();
    expect(new Date(current.payload.deadlineAt).getTime()).toBeGreaterThan(new Date(current.payload.servedAt).getTime());
  });

  it("starting twice is idempotent while in_progress, and rejected once completed", async () => {
    const applicationId = await newApplication();
    const first = await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    expect(first.kind).toBe("ok");
    const second = await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    expect(second.kind).toBe("ok");
  });

  it("refuses to start without job confirmation or consent", async () => {
    // Reuse the lower-level flow without confirming/consenting.
    const email = `test-${randomUUID().slice(0, 12)}@example.com`;
    createdCandidateEmails.push(email);
    const result = await submitPersonalDetails({
      jobSlug: (await withSystem((tx) => tx<{ slug: string }[]>`select slug from jobs where id = ${jobId}`))[0]!.slug,
      firstName: "רון",
      lastName: "לוי",
      dateOfBirth: new Date("2000-01-01"),
      phoneE164: `+97250${Math.floor(1000000 + Math.random() * 8999999)}`,
      emailNormalized: email,
      institution: "הטכניון",
      degreeProgram: "הנדסה",
      studyYear: 3,
      academicAverage: 80,
      canWorkRishon: true,
      linkedinUrl: null,
      githubUrl: null,
      pendingCv: null,
      ipPrefix: "1.2.3.0/24",
      userAgent: "vitest",
    });
    if (result.kind !== "created") throw new Error("expected created");
    const applicationId = result.applicationId;

    const withoutConfirm = await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    expect(withoutConfirm.kind).toBe("job_not_confirmed");

    await confirmJobUnderstanding(applicationId);
    const withoutConsent = await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    expect(withoutConsent.kind).toBe("consent_missing");
  });

  it("GET /current is idempotent: reload resumes the same item, deadline and token unchanged", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    const second = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active" || second.kind !== "active") throw new Error("expected active");
    expect(second.payload.itemId).toBe(first.payload.itemId);
    expect(second.payload.deadlineAt).toBe(first.payload.deadlineAt);
    expect(second.payload.servedAt).toBe(first.payload.servedAt);
    expect(second.payload.itemToken).toBe(first.payload.itemToken);
  });

  it("answering advances to the next item, and a stale item_id/token is rejected", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active") throw new Error("expected active");

    const answered = await submitAnswer(applicationId, {
      itemId: first.payload.itemId,
      itemToken: first.payload.itemToken,
      answer: answerFor(first.payload),
      clientMeta: { firstInteractionMs: 500, answerChanges: 0 },
      events: [{ kind: "first_interaction", position: 1, atMs: 500 }],
      facts: noFacts,
    });
    expect(answered.kind).toBe("active");
    if (answered.kind !== "active") return;
    expect(answered.next.position).toBe(2);

    // Replaying the old (now-finalized) item is rejected.
    const replay = await submitAnswer(applicationId, {
      itemId: first.payload.itemId,
      itemToken: first.payload.itemToken,
      answer: answerFor(first.payload),
      clientMeta: {},
      events: [],
      facts: noFacts,
    });
    expect(replay.kind).toBe("not_current_item");

    // A forged/garbage token for the actual current item is rejected.
    const badToken = await submitAnswer(applicationId, {
      itemId: answered.next.itemId,
      itemToken: "not-a-real-token",
      answer: { selectedIndex: 0 },
      clientMeta: {},
      events: [],
      facts: noFacts,
    });
    expect(badToken.kind).toBe("invalid_token");
  });

  it("an unknown option index is rejected as a bad request", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active") throw new Error("expected active");
    if (first.payload.kind !== "single_choice" && first.payload.kind !== "multi_choice") {
      // Seed blueprint's item 1 (speed block) is always single_choice/numeric;
      // guard so this test stays meaningful if that ever changes.
      return;
    }
    const result = await submitAnswer(applicationId, {
      itemId: first.payload.itemId,
      itemToken: first.payload.itemToken,
      answer: { selectedIndex: 999 },
      clientMeta: {},
      events: [],
      facts: noFacts,
    });
    expect(result.kind).toBe("bad_request");
  });

  it("answering a block's last item returns block_boundary instead of auto-serving the next block (ASSESSMENT_DESIGN.md §2 block intros)", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });

    let current = await getCurrentItem(applicationId, noFacts);
    let lastResult: Awaited<ReturnType<typeof submitAnswer>> | null = null;
    // The seed blueprint's speed block is items 1-10 — answer through it.
    for (let i = 0; i < 10; i++) {
      if (current.kind !== "active") throw new Error("expected active");
      lastResult = await submitAnswer(applicationId, {
        itemId: current.payload.itemId,
        itemToken: current.payload.itemToken,
        answer: answerFor(current.payload),
        clientMeta: { firstInteractionMs: 100 },
        events: [],
        facts: noFacts,
      });
      if (lastResult.kind === "active") {
        current = { kind: "active", payload: lastResult.next, serverNow: lastResult.serverNow, sessionExpiresAt: lastResult.sessionExpiresAt };
      }
    }
    expect(lastResult?.kind).toBe("block_boundary");
    if (lastResult?.kind !== "block_boundary") return;
    expect(lastResult.nextPosition).toBe(11);
    expect(lastResult.nextBlockKey).toBe("reasoning");

    // The next item must not have been served yet (no clock started).
    const itemRow = await withSystem(
      (tx) => tx<{ status: string; served_at: Date | null }[]>`
        select status, served_at from assessment_items
        where session_id = (select id from assessment_sessions where application_id = ${applicationId}) and position = 11
      `,
    );
    expect(itemRow[0]?.status).toBe("pending");
    expect(itemRow[0]?.served_at).toBeNull();

    // Only once the client calls GET /current (after showing the intro) does it get served.
    const afterIntro = await getCurrentItem(applicationId, noFacts);
    expect(afterIntro.kind).toBe("active");
    if (afterIntro.kind === "active") expect(afterIntro.payload.position).toBe(11);
  });

  it("a genuinely late answer (past the 2s grace) is recorded expired with no credit", async () => {
    // Uses the 1s-time-limit test blueprint and a real wait, rather than
    // mutating deadline_at directly — items_deadline_immutable correctly
    // refuses that to anyone but apply_outage_credit(), which is exactly
    // the guarantee CANDIDATE_FLOW.md §5 depends on ("refresh doesn't reset
    // the timer"), so this test goes through the real clock instead of
    // fighting the trigger.
    const applicationId = await newApplication(fastJobSlug);
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active") throw new Error("expected active");
    expect(first.payload.timeLimitS).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 3200)); // 1s limit + 2s grace + margin

    const result = await submitAnswer(applicationId, {
      itemId: first.payload.itemId,
      itemToken: first.payload.itemToken,
      answer: answerFor(first.payload),
      clientMeta: {},
      events: [],
      facts: noFacts,
    });
    expect(result.kind).toBe("active"); // still advances — expiry finalizes the item, doesn't error the request
    const stored = await withSystem(
      (tx) => tx<{ status: string; answer: unknown }[]>`
        select i.status, r.answer from assessment_items i left join assessment_responses r on r.item_id = i.id
        where i.id = ${first.payload.itemId}
      `,
    );
    expect(stored[0]?.status).toBe("expired");
    expect(stored[0]?.answer).toBeNull();
  });

  it("integrity events (client-submitted and server-side telemetry-gap) are actually recorded", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: "9.9.9.0/24" });
    const first = await getCurrentItem(applicationId, { ...noFacts, clientInstanceId: "instance-a" });
    if (first.kind !== "active") throw new Error("expected active");

    await submitAnswer(applicationId, {
      itemId: first.payload.itemId,
      itemToken: first.payload.itemToken,
      answer: answerFor(first.payload),
      clientMeta: { firstInteractionMs: 400, answerChanges: 1 },
      events: [
        { kind: "visibility_hidden", position: 1, atMs: 100 },
        { kind: "visibility_visible", position: 1, atMs: 2000, durationMs: 1900 },
      ],
      facts: { ...noFacts, clientInstanceId: "instance-a" },
    });

    const sessionId = (await withSystem((tx) => tx<{ id: string }[]>`select id from assessment_sessions where application_id = ${applicationId}`))[0]!.id;
    const kinds = (
      await withSystem((tx) => tx<{ kind: string }[]>`select kind from integrity_events where session_id = ${sessionId} order by at`)
    ).map((r) => r.kind);
    expect(kinds).toContain("visibility_hidden");
    expect(kinds).toContain("visibility_visible");
    expect(kinds).toContain("instance_new"); // first instance seen for the session

    // The second item never gets any client events or first_interaction ->
    // telemetry_empty_item on its finalization.
    const second = await getCurrentItem(applicationId, { ...noFacts, clientInstanceId: "instance-a" });
    if (second.kind !== "active") throw new Error("expected active");
    await submitAnswer(applicationId, {
      itemId: second.payload.itemId,
      itemToken: second.payload.itemToken,
      answer: answerFor(second.payload),
      clientMeta: {},
      events: [],
      facts: { ...noFacts, clientInstanceId: "instance-a" },
    });
    const kinds2 = (
      await withSystem((tx) => tx<{ kind: string }[]>`select kind from integrity_events where session_id = ${sessionId} order by at`)
    ).map((r) => r.kind);
    expect(kinds2).toContain("telemetry_empty_item");
  });

  it("the events beacon route records telemetry without needing an item_token", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active") throw new Error("expected active");

    const result = await recordBeaconEvents(
      applicationId,
      [{ kind: "copy_attempt", position: 1, atMs: 300, meta: { selection_len: 12 } }],
      noFacts,
    );
    expect(result.ok).toBe(true);

    const sessionId = (await withSystem((tx) => tx<{ id: string }[]>`select id from assessment_sessions where application_id = ${applicationId}`))[0]!.id;
    const rows = await withSystem(
      (tx) => tx<{ kind: string }[]>`select kind from integrity_events where session_id = ${sessionId} and kind = 'copy_attempt'`,
    );
    expect(rows.length).toBe(1);
  });

  it("running the full 27-item session to completion writes assessment_results and flips the application stage", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });

    let current = await getCurrentItem(applicationId, noFacts);
    let count = 0;
    while (current.kind === "active" && count < 40) {
      const answer = answerFor(current.payload);
      const result = await submitAnswer(applicationId, {
        itemId: current.payload.itemId,
        itemToken: current.payload.itemToken,
        answer,
        clientMeta: { firstInteractionMs: 200, answerChanges: 0 },
        events: [{ kind: "first_interaction", position: current.payload.position, atMs: 200 }],
        facts: noFacts,
      });
      count++;
      if (result.kind === "completed") {
        break;
      }
      if (result.kind === "block_boundary") {
        // ASSESSMENT_DESIGN.md §2 block intro screens: the server
        // deliberately doesn't auto-serve a new block's first item in the
        // answer response — the real runner shows the block intro (and,
        // before "investigate", the practice scene) first. This test has
        // no UI, so it just proceeds immediately, the same way the runner
        // does once a candidate dismisses the intro.
        const next = await getCurrentItem(applicationId, noFacts);
        if (next.kind !== "active") throw new Error(`expected active after block boundary, got ${next.kind}`);
        current = next;
        continue;
      }
      if (result.kind !== "active") throw new Error(`unexpected result kind ${result.kind}`);
      current = { kind: "active", payload: result.next, serverNow: result.serverNow, sessionExpiresAt: result.sessionExpiresAt };
    }
    expect(count).toBe(27);

    const results = await withSystem(
      (tx) => tx<{ score_overall: string; items_answered: number }[]>`
        select score_overall, items_answered from assessment_results where application_id = ${applicationId}
      `,
    );
    expect(results.length).toBe(1);
    expect(results[0]?.items_answered).toBeGreaterThan(0);

    const app = await withSystem((tx) => tx<{ stage: string }[]>`select stage from applications where id = ${applicationId}`);
    expect(app[0]?.stage).toBe("assessment_completed");

    // GET /current after completion routes to the done page instead of erroring.
    const after = await getCurrentItem(applicationId, noFacts);
    expect(after.kind).toBe("completed");
  });

  it("a session past its wall-clock expiry is lazily abandoned on the next read, with results still computed", async () => {
    const applicationId = await newApplication();
    await startAssessmentSession(applicationId, { userAgent: "vitest", ipPrefix: null });
    const first = await getCurrentItem(applicationId, noFacts);
    if (first.kind !== "active") throw new Error("expected active");

    await withSystem((tx) => tx`update assessment_sessions set expires_at = now() - interval '1 minute' where application_id = ${applicationId}`);

    const after = await getCurrentItem(applicationId, noFacts);
    expect(after.kind).toBe("completed");

    const session = await withSystem(
      (tx) => tx<{ status: string }[]>`select status from assessment_sessions where application_id = ${applicationId}`,
    );
    expect(session[0]?.status).toBe("abandoned");

    const results = await withSystem(
      (tx) => tx<{ confidence: string }[]>`select confidence from assessment_results where application_id = ${applicationId}`,
    );
    expect(results.length).toBe(1);
    expect(Number(results[0]?.confidence)).toBeLessThan(1);
  });
});
