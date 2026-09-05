import { randomBytes } from "node:crypto";
import type { TransactionSql } from "postgres";
import { withCandidate } from "@/db/postgres";
import { generateSession, type Blueprint, type GeneratedItem } from "@/assessment/generator";
import { scoreItem, scoreSession, type CandidateAnswer, type ScoringEvent, type ScoringItem, type ScoringResponse } from "@/assessment/scoring";
import { computeIntegrity, type IntegrityEvent, type IntegrityEventKind, type IntegrityItem, type IntegrityResponse } from "@/assessment/integrity";
import { ANSWER_GRACE_MS, CLOCK_ANOMALY_THRESHOLD_MS, computeDeadline, evaluateSubmission } from "@/assessment/timing";
import type { AnswerKey, Artifact, InvestigationContent, ItemContent, ItemKind } from "@/assessment/types";
import { computeItemToken, verifyItemToken } from "@/lib/item-token";
import { loadEnv } from "@/lib/env";
import { now as serverNow } from "@/lib/clock";
import { stepPath } from "@/lib/application-guard";
import { ensureOutageBootCheckRan } from "@/lib/outage-boot-check";
import { parseBlueprint } from "./assessment-blueprint";

// ARCHITECTURE.md §5.2 / CANDIDATE_FLOW.md §5 / ANTI_CHEATING.md §3: all the
// DB-touching logic behind the assessment runner's three hot-path routes
// (start/current/answer) plus the events beacon. Everything here runs
// inside `withCandidate` (RLS scopes every query to this application's own
// session/items/responses/events — see DATA_MODEL.md §6.3), so a bug here
// can misbehave but can never leak another candidate's session.

const LIVENESS_TOUCH_INTERVAL_S = 15;

async function touchLiveness(tx: TransactionSql): Promise<void> {
  await tx`
    update liveness set at = now()
    where id = true and at < now() - make_interval(secs => ${LIVENESS_TOUCH_INTERVAL_S})
  `;
}

// ---------------------------------------------------------------------------
// Request facts (device/network signals carried on every hot-path request)
// ---------------------------------------------------------------------------

export interface RequestFacts {
  ipPrefix: string | null;
  userAgent: string | null;
  clientInstanceId: string | null;
  clientNowMs: number | null;
  timezone?: string | null;
  screenW?: number | null;
  screenH?: number | null;
  dpr?: number | null;
}

interface SessionFactsRow {
  id: string;
  application_id: string;
  status: string;
  current_position: number;
  total_items: number;
  started_at: Date;
  expires_at: Date;
  config_id: string;
  config_version: number;
  seed: string;
  client_instance_id: string | null;
  user_agent: string | null;
  last_ip_prefix: string | null;
  last_skew_ms: number | null;
  timezone: string | null;
  screen_w: number | null;
  screen_h: number | null;
  dpr: string | null;
  updated_at: Date;
}

async function insertEvent(
  tx: TransactionSql,
  sessionId: string,
  itemId: string | null,
  kind: IntegrityEventKind,
  meta: Record<string, unknown>,
  opts: { ip?: string | null; durationMs?: number | null; at?: Date; clientInstanceId?: string | null } = {},
): Promise<void> {
  await tx`
    insert into integrity_events (session_id, item_id, kind, at, duration_ms, meta, ip, client_instance_id)
    values (${sessionId}, ${itemId}, ${kind}, ${opts.at ?? serverNow()}, ${opts.durationMs ?? null}, ${tx.json(meta as never)}, ${opts.ip ?? null}, ${opts.clientInstanceId ?? null})
  `;
}

/**
 * Session-level device/network telemetry (ANTI_CHEATING.md §3): detects and
 * records `instance_new`/`instance_conflict`/`ip_change`/`ua_change`/
 * `clock_anomaly` by comparing this request's facts against what was last
 * seen on the session row, then updates that row. Runs on every hot-path
 * request (current/answer). Simplification (documented in
 * IMPLEMENTATION_NOTES.md): "recent activity" for the instance_conflict
 * check uses the session row's own `updated_at` as a proxy for "was the
 * previous instance active in the last 30s" rather than a dedicated
 * per-instance last-seen table.
 */
async function syncSessionFacts(tx: TransactionSql, session: SessionFactsRow, facts: RequestFacts): Promise<void> {
  if (facts.clientInstanceId) {
    if (!session.client_instance_id) {
      await tx`update assessment_sessions set client_instance_id = ${facts.clientInstanceId} where id = ${session.id}`;
      await insertEvent(tx, session.id, null, "instance_new", { instance: facts.clientInstanceId, ordinal: 1 }, { ip: facts.ipPrefix, clientInstanceId: facts.clientInstanceId });
    } else if (session.client_instance_id !== facts.clientInstanceId) {
      const countRows = await tx<{ count: number }[]>`
        select count(*)::int as count from integrity_events where session_id = ${session.id} and kind = 'instance_new'
      `;
      const count = countRows[0]?.count ?? 0;
      const recentActivity = serverNow().getTime() - session.updated_at.getTime() < 30_000;
      if (recentActivity) {
        await insertEvent(
          tx,
          session.id,
          null,
          "instance_conflict",
          { prev_instance: session.client_instance_id, new_instance: facts.clientInstanceId },
          { ip: facts.ipPrefix, clientInstanceId: facts.clientInstanceId },
        );
      }
      await tx`update assessment_sessions set client_instance_id = ${facts.clientInstanceId} where id = ${session.id}`;
      await insertEvent(
        tx,
        session.id,
        null,
        "instance_new",
        { instance: facts.clientInstanceId, ordinal: count + 1 },
        { ip: facts.ipPrefix, clientInstanceId: facts.clientInstanceId },
      );
    }
  }

  if (facts.ipPrefix) {
    if (!session.last_ip_prefix) {
      await tx`update assessment_sessions set last_ip_prefix = ${facts.ipPrefix} where id = ${session.id}`;
    } else if (session.last_ip_prefix !== facts.ipPrefix) {
      await insertEvent(tx, session.id, null, "ip_change", { from_prefix: session.last_ip_prefix, to_prefix: facts.ipPrefix }, { ip: facts.ipPrefix });
      await tx`update assessment_sessions set last_ip_prefix = ${facts.ipPrefix} where id = ${session.id}`;
    }
  }

  if (facts.userAgent) {
    if (!session.user_agent) {
      await tx`update assessment_sessions set user_agent = ${facts.userAgent} where id = ${session.id}`;
    } else if (session.user_agent !== facts.userAgent) {
      await insertEvent(tx, session.id, null, "ua_change", { from: session.user_agent, to: facts.userAgent });
      await tx`update assessment_sessions set user_agent = ${facts.userAgent} where id = ${session.id}`;
    }
  }

  if (facts.clientNowMs != null) {
    const skewMs = Math.round(serverNow().getTime() - facts.clientNowMs);
    if (session.last_skew_ms != null && Math.abs(skewMs - session.last_skew_ms) > CLOCK_ANOMALY_THRESHOLD_MS) {
      await insertEvent(tx, session.id, null, "clock_anomaly", { skew_ms: skewMs, prev_skew_ms: session.last_skew_ms });
    }
    await tx`update assessment_sessions set last_skew_ms = ${skewMs} where id = ${session.id}`;
  }

  if (facts.timezone && !session.timezone) {
    await tx`update assessment_sessions set timezone = ${facts.timezone} where id = ${session.id}`;
  }
  if (facts.screenW != null && facts.screenH != null && session.screen_w == null) {
    await tx`update assessment_sessions set screen_w = ${facts.screenW}, screen_h = ${facts.screenH} where id = ${session.id}`;
  }
  if (facts.dpr != null && session.dpr == null) {
    await tx`update assessment_sessions set dpr = ${facts.dpr} where id = ${session.id}`;
  }
}

// ---------------------------------------------------------------------------
// startAssessmentSession — POST /api/assessment/start
// ---------------------------------------------------------------------------

export type StartAssessmentResult =
  | { kind: "ok"; redirectTo: string }
  | { kind: "job_not_confirmed" }
  | { kind: "consent_missing" }
  | { kind: "already_completed" };

function randomSeed64(): bigint {
  const bytes = randomBytes(8);
  bytes[0] = (bytes[0] as number) & 0x7f; // keep it a non-negative signed int64 (Postgres bigint range)
  return BigInt(`0x${bytes.toString("hex")}`);
}

export async function startAssessmentSession(
  applicationId: string,
  facts: { userAgent: string | null; ipPrefix: string | null },
): Promise<StartAssessmentResult> {
  await ensureOutageBootCheckRan();
  return withCandidate(applicationId, async (tx) => {
    await touchLiveness(tx);

    const [app] = await tx<
      Array<{
        job_id: string;
        job_confirmed_at: Date | null;
        stage: string;
        assessment_config_id: string;
        consent_count: string;
      }>
    >`
      select a.job_id, a.job_confirmed_at, a.stage, j.assessment_config_id,
        (select count(*)::text from consents where application_id = a.id and kind = 'assessment_monitoring_v1') as consent_count
      from applications a
      join jobs j on j.id = a.job_id
      where a.id = ${applicationId}
      limit 1
    `;
    if (!app) return { kind: "already_completed" }; // unreachable in practice (cookie already validated the row exists)
    if (!app.job_confirmed_at) return { kind: "job_not_confirmed" };
    if (Number(app.consent_count) === 0) return { kind: "consent_missing" };

    const [existing] = await tx<Array<{ id: string; status: string }>>`
      select id, status from assessment_sessions where application_id = ${applicationId} limit 1
    `;
    if (existing) {
      if (existing.status === "in_progress") {
        return { kind: "ok", redirectTo: stepPath(applicationId, "assessment") };
      }
      return { kind: "already_completed" };
    }

    const [config] = await tx<Array<{ id: string; blueprint: unknown }>>`
      select id, blueprint from assessment_configs where id = ${app.assessment_config_id} limit 1
    `;
    if (!config) throw new Error(`startAssessmentSession: assessment_config ${app.assessment_config_id} not found`);
    const blueprint: Blueprint = parseBlueprint(config.blueprint);

    // ASSESSMENT_DESIGN.md §3.3.1 cohort balancing: prior usage of each
    // investigate.* scenario within this job's sessions.
    const usageRows = await tx<Array<{ template_id: string; count: string }>>`
      select i.template_id, count(*)::text as count
      from assessment_items i
      where i.session_id in (select id from assessment_sessions where application_id in (select id from applications where job_id = ${app.job_id}))
        and i.template_id like 'investigate.%'
      group by i.template_id
    `;
    const scenarioUsageCounts = Object.fromEntries(usageRows.map((r) => [r.template_id, Number(r.count)]));

    const seed = randomSeed64();
    const items: GeneratedItem[] = generateSession(blueprint, seed, { scenarioUsageCounts });

    const wallClockMs = blueprint.session_wall_clock_min * 60_000;
    const startedAt = serverNow();
    const expiresAt = new Date(startedAt.getTime() + wallClockMs);

    const [session] = await tx<Array<{ id: string }>>`
      insert into assessment_sessions (
        application_id, config_id, config_version, seed, status, current_position,
        total_items, started_at, expires_at, user_agent
      ) values (
        ${applicationId}, ${config.id}, ${blueprint.version}, ${seed.toString()}, 'in_progress', 1,
        ${items.length}, ${startedAt}, ${expiresAt}, ${facts.userAgent}
      )
      returning id
    `;
    if (!session) throw new Error("startAssessmentSession: session insert returned no row");
    const sessionId = session.id;

    await Promise.all(
      items.map((item) =>
        tx`
          insert into assessment_items (
            session_id, position, block_key, pillar, template_id, template_version,
            variant_seed, kind, difficulty, time_limit_s, content, answer_key, status
          ) values (
            ${sessionId}, ${item.position}, ${item.blockKey}, ${item.pillar}, ${item.templateId}, ${item.templateVersion},
            ${item.variantSeed.toString()}, ${item.kind}, ${item.difficulty}, ${item.timeLimitS},
            ${tx.json(item.content as never)}, ${tx.json(item.answerKey as never)}, 'pending'
          )
        `,
      ),
    );

    await tx`select assessment_mark_stage(${applicationId}, 'assessment_started', 'session started')`;

    return { kind: "ok", redirectTo: stepPath(applicationId, "assessment") };
  });
}

// ---------------------------------------------------------------------------
// Item content shaping — never leak answer_key or the decoy flag
// ---------------------------------------------------------------------------

function sanitizeContentForClient(kind: ItemKind, content: ItemContent): ItemContent {
  if (kind === "investigation") {
    const c = content as InvestigationContent;
    return {
      ...c,
      tabs: c.tabs.map((t: Artifact) => ({ key: t.key, label: t.label, body: t.body })),
    };
  }
  return content;
}

export interface CurrentItemPayload {
  itemId: string;
  position: number;
  totalItems: number;
  blockKey: string;
  pillar: string;
  kind: ItemKind;
  difficulty: number;
  timeLimitS: number;
  content: ItemContent;
  servedAt: string;
  deadlineAt: string;
  outageCreditMs: number;
  itemToken: string;
}

export type CurrentItemResult =
  | { kind: "active"; payload: CurrentItemPayload; serverNow: string; sessionExpiresAt: string }
  | { kind: "completed"; redirectTo: string }
  | { kind: "no_session" };

interface ItemRow {
  id: string;
  position: number;
  block_key: string;
  pillar: string;
  template_id: string;
  template_version: number;
  variant_seed: string;
  kind: ItemKind;
  difficulty: number;
  time_limit_s: number;
  content: ItemContent;
  answer_key: unknown;
  status: string;
  served_at: Date | null;
  deadline_at: Date | null;
  serve_nonce: Buffer | null;
  outage_credit_ms: number;
}

async function loadSession(tx: TransactionSql, applicationId: string): Promise<SessionFactsRow | null> {
  const rows = await tx<SessionFactsRow[]>`
    select id, application_id, status, current_position, total_items, started_at, expires_at,
      config_id, config_version, seed::text as seed, client_instance_id, user_agent,
      last_ip_prefix, last_skew_ms, timezone, screen_w, screen_h, dpr::text as dpr, updated_at
    from assessment_sessions
    where application_id = ${applicationId}
    for update
  `;
  return rows[0] ?? null;
}

/** Marks a still-`served` item `expired` (deadline passed with no on-time answer) and records why. */
async function expireItem(tx: TransactionSql, sessionId: string, item: ItemRow): Promise<void> {
  await tx`update assessment_items set status = 'expired', finalized_at = now() where id = ${item.id}`;
  await tx`
    insert into assessment_responses (item_id, session_id, answer, is_correct, partial_credit, response_ms, first_interaction_ms, answer_changes, late_by_ms)
    values (${item.id}, ${sessionId}, null, false, 0, null, null, 0, 0)
  `;
  await insertEvent(tx, sessionId, item.id, "expired", { item_position: item.position });
}

function itemToPayload(item: ItemRow, totalItems: number, token: string): CurrentItemPayload {
  return {
    itemId: item.id,
    position: item.position,
    totalItems,
    blockKey: item.block_key,
    pillar: item.pillar,
    kind: item.kind,
    difficulty: item.difficulty,
    timeLimitS: item.time_limit_s,
    content: sanitizeContentForClient(item.kind, item.content),
    servedAt: (item.served_at as Date).toISOString(),
    deadlineAt: (item.deadline_at as Date).toISOString(),
    outageCreditMs: item.outage_credit_ms,
    itemToken: token,
  };
}

/** Scores + finalizes a session that has no more live items (SCORING.md, ANTI_CHEATING.md §5). */
async function finalizeSession(
  tx: TransactionSql,
  session: { id: string; application_id: string; config_id: string; config_version: number },
  status: "completed" | "abandoned",
): Promise<void> {
  const [config] = await tx<Array<{ blueprint: unknown }>>`
    select blueprint from assessment_configs where id = ${session.config_id} limit 1
  `;
  const blueprint = config ? parseBlueprint(config.blueprint) : null;

  const itemRows = await tx<
    Array<{
      position: number;
      block_key: string;
      pillar: ScoringItem["pillar"];
      kind: ItemKind;
      difficulty: 1 | 2 | 3;
      time_limit_s: number;
      answer_key: unknown;
      template_id: string;
      outage_credit_ms: number;
      content: ItemContent;
      served_at: Date | null;
      status: string;
    }>
  >`
    select position, block_key, pillar, kind, difficulty, time_limit_s, answer_key, template_id,
      outage_credit_ms, content, served_at, status
    from assessment_items where session_id = ${session.id} order by position
  `;

  const responseRows = await tx<
    Array<{
      position: number;
      status: string;
      answer: unknown;
      response_ms: number | null;
      first_interaction_ms: number | null;
      answer_changes: number;
      has_response_row: boolean;
    }>
  >`
    select i.position, i.status, r.answer, r.response_ms, r.first_interaction_ms, r.answer_changes,
      r.item_id is not null as has_response_row
    from assessment_items i
    left join assessment_responses r on r.item_id = i.id
    where i.session_id = ${session.id}
    order by i.position
  `;

  const eventRows = await tx<Array<{ position: number | null; kind: IntegrityEventKind; duration_ms: number | null; meta: { artifact_key?: string } | null; at: Date }>>`
    select i.position, e.kind, e.duration_ms, e.meta, e.at
    from integrity_events e
    left join assessment_items i on i.id = e.item_id
    where e.session_id = ${session.id}
  `;

  const servedAtByPos = new Map(itemRows.map((r) => [r.position, r.served_at]));

  const items: ScoringItem[] = itemRows.map((r) => ({
    position: r.position,
    blockKey: r.block_key as ScoringItem["blockKey"],
    pillar: r.pillar,
    kind: r.kind,
    difficulty: r.difficulty,
    timeLimitS: r.time_limit_s,
    answerKey: r.answer_key as ScoringItem["answerKey"],
    templateId: r.template_id,
    outageCreditMs: r.outage_credit_ms,
    artifactKeys: r.kind === "investigation" ? (r.content as InvestigationContent).tabs.map((t) => t.key) : undefined,
  }));

  const responses: ScoringResponse[] = responseRows
    .filter((r) => r.has_response_row && (r.status === "answered" || r.status === "expired" || r.status === "skipped"))
    .map((r) => ({
      position: r.position,
      status: r.status as ScoringResponse["status"],
      answer: r.answer as CandidateAnswer | null,
      responseMs: r.response_ms,
      firstInteractionMs: r.first_interaction_ms,
      answerChanges: r.answer_changes,
    }));

  const scoringEvents: ScoringEvent[] = eventRows
    .filter((e): e is typeof e & { position: number } => (e.kind === "artifact_open" || e.kind === "network_retry") && e.position !== null)
    .map((e) => {
      const servedAt = servedAtByPos.get(e.position);
      const atMs = servedAt ? e.at.getTime() - servedAt.getTime() : 0;
      return { position: e.position, kind: e.kind as "artifact_open" | "network_retry", atMs, artifactKey: e.meta?.artifact_key };
    });

  const scoreResult = scoreSession({
    items,
    responses,
    events: scoringEvents,
    blueprint: { weights: blueprint?.weights ?? { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 } },
  });

  const decisiveOpenedByPos = new Map(
    scoreResult.breakdown.items.filter((i) => i.decisiveArtifactOpened !== undefined).map((i) => [i.pos, i.decisiveArtifactOpened as boolean]),
  );

  const integrityItems: IntegrityItem[] = itemRows.map((r) => ({
    position: r.position,
    kind: r.kind,
    difficulty: r.difficulty,
    timeLimitS: r.time_limit_s,
    outageCreditMs: r.outage_credit_ms,
  }));
  const integrityResponses: IntegrityResponse[] = responseRows
    .filter((r) => r.has_response_row && (r.status === "answered" || r.status === "expired" || r.status === "skipped"))
    .map((r) => {
      const item = itemRows.find((i) => i.position === r.position);
      const sI = item ? scoreItem(item.kind, r.answer as CandidateAnswer | null, item.answer_key as AnswerKey).isCorrect : false;
      return {
        position: r.position,
        isCorrect: sI,
        responseMs: r.response_ms,
        firstInteractionMs: r.first_interaction_ms,
        decisiveArtifactOpened: decisiveOpenedByPos.get(r.position),
      };
    });
  const integrityEvents: IntegrityEvent[] = eventRows.map((e) => ({
    position: e.position,
    kind: e.kind,
    durationMs: e.duration_ms ?? undefined,
  }));

  const integrityResult = computeIntegrity(integrityItems, integrityResponses, integrityEvents);

  const [appRow] = await tx<Array<{ job_id: string }>>`select job_id from applications where id = ${session.application_id} limit 1`;
  const jobId = appRow?.job_id;
  if (!jobId) throw new Error(`finalizeSession: application ${session.application_id} not found`);

  await tx`
    insert into assessment_results (
      session_id, application_id, job_id, scoring_version,
      score_reasoning, score_independence, score_tech, score_speed, score_overall,
      confidence, items_answered, items_expired, items_correct, median_response_ms,
      integrity_risk, integrity_score, integrity_reasons, breakdown
    ) values (
      ${session.id}, ${session.application_id}, ${jobId}, 1,
      ${scoreResult.scoreReasoning}, ${scoreResult.scoreIndependence}, ${scoreResult.scoreTech}, ${scoreResult.scoreSpeed}, ${scoreResult.scoreOverall},
      ${scoreResult.confidence}, ${scoreResult.itemsAnswered}, ${scoreResult.itemsExpired}, ${scoreResult.itemsCorrect}, ${scoreResult.medianResponseMs},
      ${integrityResult.risk}, ${integrityResult.score}, ${tx.json(integrityResult.reasons as never)}, ${tx.json(scoreResult.breakdown as never)}
    )
    on conflict (session_id) do nothing
  `;

  await tx`select finalize_session(${session.id}, ${status})`;
  await tx`
    select assessment_mark_stage(
      ${session.application_id}, 'assessment_completed',
      ${status === "abandoned" ? "session abandoned (wall clock)" : "session completed"}
    )
  `;
}

export async function getCurrentItem(applicationId: string, facts: RequestFacts): Promise<CurrentItemResult> {
  const env = loadEnv();
  await ensureOutageBootCheckRan();
  return withCandidate(applicationId, async (tx) => {
    await touchLiveness(tx);
    const session = await loadSession(tx, applicationId);
    if (!session) return { kind: "no_session" };

    if (session.status !== "in_progress") {
      return { kind: "completed", redirectTo: stepPath(applicationId, "done") };
    }

    if (serverNow().getTime() > session.expires_at.getTime()) {
      await abandonRemainingItems(tx, session.id);
      await finalizeSession(tx, { id: session.id, application_id: applicationId, config_id: session.config_id, config_version: session.config_version }, "abandoned");
      return { kind: "completed", redirectTo: stepPath(applicationId, "done") };
    }

    await syncSessionFacts(tx, session, facts);

    // Loop: clear out any item(s) whose deadline passed while nobody was
    // looking (tab closed mid-item, machine slept, etc.) — CANDIDATE_FLOW.md
    // §5: "the candidate loses nothing except the seconds that elapsed",
    // but a truly-missed deadline still finalizes as expired, not frozen.
    for (;;) {
      const [served] = await tx<ItemRow[]>`
        select id, position, block_key, pillar, template_id, template_version, variant_seed::text as variant_seed,
          kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, serve_nonce, outage_credit_ms
        from assessment_items where session_id = ${session.id} and status = 'served' limit 1
      `;
      if (served) {
        const deadline = served.deadline_at as Date;
        if (serverNow().getTime() > deadline.getTime() + ANSWER_GRACE_MS) {
          await expireItem(tx, session.id, served);
          continue;
        }
        const token = computeItemToken(served.id, served.serve_nonce as Buffer, env.ITEM_TOKEN_SECRET);
        return {
          kind: "active",
          payload: itemToPayload(served, session.total_items, token),
          serverNow: serverNow().toISOString(),
          sessionExpiresAt: session.expires_at.toISOString(),
        };
      }

      const [pending] = await tx<ItemRow[]>`
        select id, position, block_key, pillar, template_id, template_version, variant_seed::text as variant_seed,
          kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, serve_nonce, outage_credit_ms
        from assessment_items where session_id = ${session.id} and status = 'pending' order by position limit 1
      `;
      if (!pending) {
        await finalizeSession(tx, { id: session.id, application_id: applicationId, config_id: session.config_id, config_version: session.config_version }, "completed");
        return { kind: "completed", redirectTo: stepPath(applicationId, "done") };
      }

      const nonce = randomBytes(16);
      const servedAt = serverNow();
      const deadlineAt = computeDeadline(servedAt, pending.time_limit_s);
      await tx`
        update assessment_items set status = 'served', served_at = ${servedAt}, deadline_at = ${deadlineAt}, serve_nonce = ${nonce}
        where id = ${pending.id}
      `;
      await tx`update assessment_sessions set current_position = ${pending.position} where id = ${session.id}`;
      pending.status = "served";
      pending.served_at = servedAt;
      pending.deadline_at = deadlineAt;
      pending.serve_nonce = nonce;
      const token = computeItemToken(pending.id, nonce, env.ITEM_TOKEN_SECRET);
      return {
        kind: "active",
        payload: itemToPayload(pending, session.total_items, token),
        serverNow: serverNow().toISOString(),
        sessionExpiresAt: session.expires_at.toISOString(),
      };
    }
  });
}

async function abandonRemainingItems(tx: TransactionSql, sessionId: string): Promise<void> {
  const rows = await tx<ItemRow[]>`
    select id, position, block_key, pillar, template_id, template_version, variant_seed::text as variant_seed,
      kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, serve_nonce, outage_credit_ms
    from assessment_items where session_id = ${sessionId} and status in ('pending', 'served')
    order by position
  `;
  for (const item of rows) {
    if (item.status === "served") {
      await expireItem(tx, sessionId, item);
    } else {
      // Never served at all — no response row to insert (nothing was ever
      // measured), matching ScoringResponse's "responseMs null only if truly
      // never submitted" contract (scoring.ts doc comment).
      await tx`update assessment_items set status = 'expired', finalized_at = now() where id = ${item.id}`;
      await insertEvent(tx, sessionId, item.id, "expired", { item_position: item.position });
    }
  }
}

// ---------------------------------------------------------------------------
// submitAnswer — POST /api/assessment/answer
// ---------------------------------------------------------------------------

export interface ClientEventInput {
  kind: string;
  position: number | null;
  atMs: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

export interface SubmitAnswerInput {
  itemId: string;
  itemToken: string;
  answer: unknown;
  clientMeta: {
    firstInteractionMs?: number | null;
    answerChanges?: number;
  };
  events: ClientEventInput[];
  facts: RequestFacts;
}

export type SubmitAnswerResult =
  | { kind: "active"; next: CurrentItemPayload; serverNow: string; sessionExpiresAt: string }
  /**
   * The just-answered item was the last one in its block, and the next
   * item (not yet served — its clock has NOT started) begins a new block.
   * ASSESSMENT_DESIGN.md §2: block intro screens (and, before "investigate",
   * the untimed practice scene) are shown *before* the new block's first
   * item is served, so the server deliberately does not auto-serve it here
   * the way it does for a normal within-block transition — the client
   * shows the intro/practice screen first, then calls `GET /current` (which
   * serves it and starts its clock) once the candidate proceeds.
   */
  | { kind: "block_boundary"; nextBlockKey: string; nextPosition: number }
  | { kind: "completed"; redirectTo: string }
  | { kind: "invalid_token" }
  | { kind: "not_current_item" }
  | { kind: "no_session" }
  | { kind: "bad_request"; error: string };

const CLIENT_POSTABLE_KINDS = new Set<IntegrityEventKind>([
  "visibility_hidden",
  "visibility_visible",
  "window_blur",
  "window_focus",
  "fullscreen_enter",
  "fullscreen_exit",
  "fullscreen_unavailable",
  "copy_attempt",
  "paste_attempt",
  "contextmenu",
  "resize",
  "devtools_hint",
  "keydown_shortcut",
  "input_burst",
  "first_interaction",
  "answer_change",
  "artifact_open",
  "network_retry",
]);

async function insertClientEvents(
  tx: TransactionSql,
  sessionId: string,
  itemsByPosition: Map<number, { id: string; servedAt: Date }>,
  events: ClientEventInput[],
  facts: RequestFacts,
): Promise<void> {
  for (const e of events) {
    if (!CLIENT_POSTABLE_KINDS.has(e.kind as IntegrityEventKind)) continue;
    const item = e.position != null ? itemsByPosition.get(e.position) : undefined;
    const at = item ? new Date(item.servedAt.getTime() + e.atMs) : serverNow();
    await insertEvent(tx, sessionId, item?.id ?? null, e.kind as IntegrityEventKind, e.meta ?? {}, {
      ip: facts.ipPrefix,
      durationMs: e.durationMs ?? null,
      at,
      clientInstanceId: facts.clientInstanceId,
    });
  }
}

/** Validates the raw client answer against the item's own kind + option counts (ARCHITECTURE.md §6: "unknown option ids are already rejected before this point"). */
function validateAnswer(kind: ItemKind, content: ItemContent, raw: unknown): { ok: true; answer: CandidateAnswer | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, answer: null };
  if (typeof raw !== "object") return { ok: false };
  const r = raw as Record<string, unknown>;

  switch (kind) {
    case "single_choice": {
      const optionCount = (content as { options: string[] }).options.length;
      const v = r.selectedIndex;
      if (v === null) return { ok: true, answer: { selectedIndex: null } };
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= optionCount) return { ok: false };
      return { ok: true, answer: { selectedIndex: v } };
    }
    case "multi_choice": {
      const optionCount = (content as { options: string[] }).options.length;
      const v = r.selectedIndexes;
      if (!Array.isArray(v)) return { ok: false };
      if (!v.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < optionCount)) return { ok: false };
      return { ok: true, answer: { selectedIndexes: v } };
    }
    case "numeric": {
      const v = r.value;
      if (v !== null && typeof v !== "number" && typeof v !== "string") return { ok: false };
      return { ok: true, answer: { value: v as number | string | null } };
    }
    case "short_text": {
      const v = r.text;
      if (v !== null && typeof v !== "string") return { ok: false };
      if (typeof v === "string" && v.length > 500) return { ok: false };
      return { ok: true, answer: { text: v as string | null } };
    }
    case "ordering": {
      const itemCount = (content as { items: string[] }).items.length;
      const v = r.order;
      if (v === null) return { ok: true, answer: { order: null } };
      if (!Array.isArray(v)) return { ok: false };
      if (!v.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < itemCount)) return { ok: false };
      return { ok: true, answer: { order: v } };
    }
    case "investigation": {
      const c = content as InvestigationContent;
      const q1 = r.q1;
      const q2 = r.q2;
      const q3 = r.q3;
      if (q1 !== null && (typeof q1 !== "number" || !Number.isInteger(q1) || q1 < 0 || q1 >= c.q1.options.length)) return { ok: false };
      if (q2 !== null && (typeof q2 !== "number" || !Number.isInteger(q2) || q2 < 0 || q2 >= c.q2.options.length)) return { ok: false };
      if (q3 !== null && typeof q3 !== "string") return { ok: false };
      if (typeof q3 === "string" && q3.length > 200) return { ok: false };
      return { ok: true, answer: { q1: (q1 as number | null) ?? null, q2: (q2 as number | null) ?? null, q3: (q3 as string | null) ?? null } };
    }
    default: {
      const _exhaustive: never = kind;
      throw new Error(`validateAnswer: unhandled kind ${String(_exhaustive)}`);
    }
  }
}

export async function submitAnswer(applicationId: string, input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
  const env = loadEnv();
  await ensureOutageBootCheckRan();
  return withCandidate(applicationId, async (tx) => {
    await touchLiveness(tx);
    const session = await loadSession(tx, applicationId);
    if (!session) return { kind: "no_session" };
    if (session.status !== "in_progress") return { kind: "completed", redirectTo: stepPath(applicationId, "done") };

    if (serverNow().getTime() > session.expires_at.getTime()) {
      await abandonRemainingItems(tx, session.id);
      await finalizeSession(tx, { id: session.id, application_id: applicationId, config_id: session.config_id, config_version: session.config_version }, "abandoned");
      return { kind: "completed", redirectTo: stepPath(applicationId, "done") };
    }

    await syncSessionFacts(tx, session, input.facts);

    const [item] = await tx<ItemRow[]>`
      select id, position, block_key, pillar, template_id, template_version, variant_seed::text as variant_seed,
        kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, serve_nonce, outage_credit_ms
      from assessment_items where id = ${input.itemId} and session_id = ${session.id} limit 1
    `;
    if (!item) return { kind: "no_session" };
    if (item.status !== "served") return { kind: "not_current_item" };
    if (!item.serve_nonce || !verifyItemToken(item.id, item.serve_nonce, env.ITEM_TOKEN_SECRET, input.itemToken)) {
      return { kind: "invalid_token" };
    }

    const validated = validateAnswer(item.kind, item.content, input.answer);
    if (!validated.ok) return { kind: "bad_request", error: "invalid_answer" };

    const receivedAt = serverNow();
    const servedAt = item.served_at as Date;
    const deadlineAt = item.deadline_at as Date;
    const evaluation = evaluateSubmission(deadlineAt, receivedAt);

    let status: "answered" | "expired" | "skipped";
    let storedAnswer: CandidateAnswer | null = validated.answer;
    let lateByMs = 0;
    if (evaluation === null) {
      status = "expired";
      storedAnswer = null; // CANDIDATE_FLOW.md §5: genuinely late -> recorded expired, no answer
    } else {
      lateByMs = evaluation.lateByMs;
      status = validated.answer === null ? "skipped" : "answered";
    }

    const scored = status === "answered" ? scoreItem(item.kind, storedAnswer, item.answer_key as AnswerKey) : { sI: 0, isCorrect: false };
    const responseMs = Math.min(receivedAt.getTime() - servedAt.getTime(), item.time_limit_s * 1000 + ANSWER_GRACE_MS);

    await tx`update assessment_items set status = ${status}, finalized_at = now() where id = ${item.id}`;
    await tx`
      insert into assessment_responses (item_id, session_id, answer, is_correct, partial_credit, response_ms, first_interaction_ms, answer_changes, late_by_ms)
      values (${item.id}, ${session.id}, ${storedAnswer === null ? null : tx.json(storedAnswer as never)}, ${scored.isCorrect}, ${scored.sI}, ${responseMs},
        ${input.clientMeta.firstInteractionMs ?? null}, ${input.clientMeta.answerChanges ?? 0}, ${lateByMs})
    `;
    if (lateByMs > 0) {
      await insertEvent(tx, session.id, item.id, "late_submit", { late_by_ms: lateByMs });
    }
    if (status === "expired") {
      await insertEvent(tx, session.id, item.id, "expired", { item_position: item.position });
    }

    const itemsByPosition = new Map([[item.position, { id: item.id, servedAt }]]);
    await insertClientEvents(tx, session.id, itemsByPosition, input.events, input.facts);

    if (item.kind === "investigation") {
      const opens = input.events.filter((e) => e.position === item.position && e.kind === "artifact_open");
      await tx`
        update assessment_responses set artifacts_opened = ${tx.json(opens.map((o) => ({ key: o.meta?.artifact_key, atMs: o.atMs })) as never)}
        where item_id = ${item.id}
      `;
    }

    const hasAnyClientEvent = input.events.some((e) => e.position === item.position && CLIENT_POSTABLE_KINDS.has(e.kind as IntegrityEventKind));
    const hasFirstInteraction = input.clientMeta.firstInteractionMs != null;
    if (!hasAnyClientEvent && !hasFirstInteraction) {
      await insertEvent(tx, session.id, item.id, "telemetry_empty_item", { item_position: item.position });
    }

    // ---- serve the next item, or finalize the session ----
    const [pending] = await tx<ItemRow[]>`
      select id, position, block_key, pillar, template_id, template_version, variant_seed::text as variant_seed,
        kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, serve_nonce, outage_credit_ms
      from assessment_items where session_id = ${session.id} and status = 'pending' order by position limit 1
    `;
    if (!pending) {
      await finalizeSession(tx, { id: session.id, application_id: applicationId, config_id: session.config_id, config_version: session.config_version }, "completed");
      return { kind: "completed", redirectTo: stepPath(applicationId, "done") };
    }

    if (pending.block_key !== item.block_key) {
      return { kind: "block_boundary", nextBlockKey: pending.block_key, nextPosition: pending.position };
    }

    const nonce = randomBytes(16);
    const nextServedAt = serverNow();
    const nextDeadlineAt = computeDeadline(nextServedAt, pending.time_limit_s);
    await tx`
      update assessment_items set status = 'served', served_at = ${nextServedAt}, deadline_at = ${nextDeadlineAt}, serve_nonce = ${nonce}
      where id = ${pending.id}
    `;
    await tx`update assessment_sessions set current_position = ${pending.position} where id = ${session.id}`;
    pending.served_at = nextServedAt;
    pending.deadline_at = nextDeadlineAt;
    const token = computeItemToken(pending.id, nonce, env.ITEM_TOKEN_SECRET);

    return {
      kind: "active",
      next: itemToPayload(pending, session.total_items, token),
      serverNow: serverNow().toISOString(),
      sessionExpiresAt: session.expires_at.toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// recordBeaconEvents — POST /api/assessment/events (sendBeacon flush)
// ---------------------------------------------------------------------------

export async function recordBeaconEvents(applicationId: string, events: ClientEventInput[], facts: RequestFacts): Promise<{ ok: boolean }> {
  return withCandidate(applicationId, async (tx) => {
    const [session] = await tx<Array<{ id: string }>>`
      select id from assessment_sessions where application_id = ${applicationId} limit 1
    `;
    if (!session) return { ok: false };

    const positions = [...new Set(events.map((e) => e.position).filter((p): p is number => p !== null))];
    const itemRows =
      positions.length > 0
        ? await tx<Array<{ id: string; position: number; served_at: Date | null }>>`
            select id, position, served_at from assessment_items where session_id = ${session.id} and position = any(${positions})
          `
        : [];
    const itemsByPosition = new Map(itemRows.filter((r) => r.served_at).map((r) => [r.position, { id: r.id, servedAt: r.served_at as Date }]));

    await insertClientEvents(tx, session.id, itemsByPosition, events, facts);
    return { ok: true };
  });
}
