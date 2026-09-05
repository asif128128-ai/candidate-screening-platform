import type { TransactionSql } from "postgres";
import type { ApplicationStage, IntegrityRisk, ItemStatus, Pillar } from "./types";

// Candidate detail page queries (ADMIN_UX.md §4). Several small, parallel
// queries rather than one giant join (ARCHITECTURE.md §5.3: "Detail pages
// do 3–4 queries in parallel"), each scoped by application_id.

export interface CandidateProfile {
  applicationId: string;
  jobId: string;
  jobTitleHe: string;
  responseWindowDays: number;
  sendRejectionEmail: boolean;
  stage: ApplicationStage;
  stageChangedAt: Date;
  appliedAt: Date;
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  dateOfBirth: string;
  institution: string;
  degreeProgram: string;
  studyYear: number;
  academicAverage: number;
  canWorkRishon: boolean;
  linkedinUrl: string | null;
  githubUrl: string | null;
  cvId: string | null;
  cvOriginalName: string | null;
  cvObjectPath: string | null;
  duplicatePhoneOf: string | null;
  duplicatePhoneOfName: string | null;
  keepIndefinitely: boolean;
  rejectionEmailSentAt: Date | null;
}

export async function getCandidateProfile(
  tx: TransactionSql,
  applicationId: string,
): Promise<CandidateProfile | null> {
  const rows = await tx<
    Array<{
      application_id: string;
      job_id: string;
      title_he: string;
      response_window_days: number;
      send_rejection_email: boolean;
      stage: ApplicationStage;
      stage_changed_at: Date;
      applied_at: Date;
      candidate_id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_e164: string;
      date_of_birth: string;
      institution: string;
      degree_program: string;
      study_year: number;
      academic_average: string;
      can_work_rishon: boolean;
      linkedin_url: string | null;
      github_url: string | null;
      cv_id: string | null;
      cv_original_name: string | null;
      cv_object_path: string | null;
      duplicate_phone_of: string | null;
      duplicate_phone_of_name: string | null;
      keep_indefinitely: boolean;
      rejection_email_sent_at: Date | null;
    }>
  >`
    select a.id as application_id, a.job_id, j.title_he, j.response_window_days, j.send_rejection_email,
      a.stage, a.stage_changed_at, a.created_at as applied_at,
      c.id as candidate_id, c.first_name, c.last_name, c.email, c.phone_e164, c.date_of_birth::text,
      c.institution, c.degree_program, c.study_year, c.academic_average,
      a.can_work_rishon, c.linkedin_url, c.github_url,
      cv.id as cv_id, cv.original_name as cv_original_name, cv.object_path as cv_object_path,
      a.duplicate_phone_of, dup.first_name || ' ' || dup.last_name as duplicate_phone_of_name,
      a.keep_indefinitely, a.rejection_email_sent_at
    from applications a
    join jobs j on j.id = a.job_id
    join candidates c on c.id = a.candidate_id
    left join cv_files cv on cv.application_id = a.id
    left join candidates dup on dup.id = a.duplicate_phone_of
    where a.id = ${applicationId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    applicationId: r.application_id,
    jobId: r.job_id,
    jobTitleHe: r.title_he,
    responseWindowDays: r.response_window_days,
    sendRejectionEmail: r.send_rejection_email,
    stage: r.stage,
    stageChangedAt: r.stage_changed_at,
    appliedAt: r.applied_at,
    candidateId: r.candidate_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phoneE164: r.phone_e164,
    dateOfBirth: r.date_of_birth,
    institution: r.institution,
    degreeProgram: r.degree_program,
    studyYear: r.study_year,
    academicAverage: Number(r.academic_average),
    canWorkRishon: r.can_work_rishon,
    linkedinUrl: r.linkedin_url,
    githubUrl: r.github_url,
    cvId: r.cv_id,
    cvOriginalName: r.cv_original_name,
    cvObjectPath: r.cv_object_path,
    duplicatePhoneOf: r.duplicate_phone_of,
    duplicatePhoneOfName: r.duplicate_phone_of_name,
    keepIndefinitely: r.keep_indefinitely,
    rejectionEmailSentAt: r.rejection_email_sent_at,
  };
}

export interface OtherApplication {
  applicationId: string;
  jobTitleHe: string;
  stage: ApplicationStage;
  appliedAt: Date;
}

export async function getOtherApplications(
  tx: TransactionSql,
  candidateId: string,
  excludeApplicationId: string,
): Promise<OtherApplication[]> {
  const rows = await tx<
    Array<{ application_id: string; title_he: string; stage: ApplicationStage; applied_at: Date }>
  >`
    select a.id as application_id, j.title_he, a.stage, a.created_at as applied_at
    from applications a join jobs j on j.id = a.job_id
    where a.candidate_id = ${candidateId} and a.id != ${excludeApplicationId}
    order by a.created_at desc
  `;
  return rows.map((r) => ({
    applicationId: r.application_id,
    jobTitleHe: r.title_he,
    stage: r.stage,
    appliedAt: r.applied_at,
  }));
}

export interface AssessmentSummary {
  sessionId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  scoreOverall: number;
  scoreReasoning: number;
  scoreIndependence: number;
  scoreTech: number;
  scoreSpeed: number;
  confidence: number;
  pctRank: number | null;
  itemsAnswered: number;
  itemsExpired: number;
  itemsCorrect: number;
  medianResponseMs: number | null;
  integrityRisk: IntegrityRisk;
  integrityRiskAdjusted: IntegrityRisk | null;
  integrityScore: number;
  integrityReasons: Array<{ code: string; he: string; weight: number; evidence: unknown }>;
  breakdown: unknown;
  integrityIgnoreFocus: boolean;
  integrityAdjustedByName: string | null;
  integrityAdjustReason: string | null;
}

export async function getAssessmentSummary(
  tx: TransactionSql,
  applicationId: string,
): Promise<AssessmentSummary | null> {
  const rows = await tx<
    Array<{
      session_id: string;
      status: string;
      started_at: Date;
      completed_at: Date | null;
      score_overall: string;
      score_reasoning: string;
      score_independence: string;
      score_tech: string;
      score_speed: string;
      confidence: string;
      pct_rank: string | null;
      items_answered: number;
      items_expired: number;
      items_correct: number;
      median_response_ms: number | null;
      integrity_risk: IntegrityRisk;
      integrity_risk_adjusted: IntegrityRisk | null;
      integrity_score: string;
      integrity_reasons: Array<{ code: string; he: string; weight: number; evidence: unknown }>;
      breakdown: unknown;
      integrity_ignore_focus: boolean;
      integrity_adjusted_by_name: string | null;
      integrity_adjust_reason: string | null;
    }>
  >`
    select s.id as session_id, s.status, s.started_at, s.completed_at,
      r.score_overall, r.score_reasoning, r.score_independence, r.score_tech, r.score_speed,
      r.confidence,
      ranked.pct_rank,
      r.items_answered, r.items_expired, r.items_correct, r.median_response_ms,
      r.integrity_risk, r.integrity_risk_adjusted, r.integrity_score, r.integrity_reasons, r.breakdown,
      r.integrity_ignore_focus, au.display_name as integrity_adjusted_by_name, r.integrity_adjust_reason
    from assessment_sessions s
    join assessment_results r on r.session_id = s.id
    left join admin_users au on au.id = r.integrity_adjusted_by
    -- percent_rank() is a window function: it must be computed over ALL of
    -- the job's results, then looked up by application_id — filtering to
    -- one application_id in the same scope as the window (e.g. inside a
    -- correlated scalar subquery) computes it over a one-row set and always
    -- yields 0. This derived table computes it correctly, once per job.
    left join lateral (
      select application_id, percent_rank() over (order by score_overall) as pct_rank
      from assessment_results
      where job_id = r.job_id
    ) ranked on ranked.application_id = r.application_id
    where s.application_id = ${applicationId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    sessionId: r.session_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    scoreOverall: Number(r.score_overall),
    scoreReasoning: Number(r.score_reasoning),
    scoreIndependence: Number(r.score_independence),
    scoreTech: Number(r.score_tech),
    scoreSpeed: Number(r.score_speed),
    confidence: Number(r.confidence),
    pctRank: r.pct_rank === null ? null : Number(r.pct_rank),
    itemsAnswered: r.items_answered,
    itemsExpired: r.items_expired,
    itemsCorrect: r.items_correct,
    medianResponseMs: r.median_response_ms,
    integrityRisk: r.integrity_risk,
    integrityRiskAdjusted: r.integrity_risk_adjusted,
    integrityScore: Number(r.integrity_score),
    integrityReasons: r.integrity_reasons ?? [],
    breakdown: r.breakdown,
    integrityIgnoreFocus: r.integrity_ignore_focus,
    integrityAdjustedByName: r.integrity_adjusted_by_name,
    integrityAdjustReason: r.integrity_adjust_reason,
  };
}

/** Session status even without a scored result yet (in-progress / abandoned). */
export async function getSessionStatusOnly(
  tx: TransactionSql,
  applicationId: string,
): Promise<{ sessionId: string; status: string; startedAt: Date; currentPosition: number; totalItems: number } | null> {
  const rows = await tx<
    Array<{ id: string; status: string; started_at: Date; current_position: number; total_items: number }>
  >`
    select id, status, started_at, current_position, total_items
    from assessment_sessions where application_id = ${applicationId} limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return { sessionId: r.id, status: r.status, startedAt: r.started_at, currentPosition: r.current_position, totalItems: r.total_items };
}

export interface ItemRow {
  id: string;
  position: number;
  blockKey: string;
  pillar: Pillar;
  templateId: string;
  difficulty: number;
  timeLimitS: number;
  status: ItemStatus;
  content: unknown;
  answerKey: unknown;
  answer: unknown;
  isCorrect: boolean | null;
  responseMs: number | null;
  outageCreditMs: number;
}

export async function listSessionItems(tx: TransactionSql, sessionId: string): Promise<ItemRow[]> {
  const rows = await tx<
    Array<{
      id: string;
      position: number;
      block_key: string;
      pillar: Pillar;
      template_id: string;
      difficulty: number;
      time_limit_s: number;
      status: ItemStatus;
      content: unknown;
      answer_key: unknown;
      answer: unknown;
      is_correct: boolean | null;
      response_ms: number | null;
      outage_credit_ms: number;
    }>
  >`
    select i.id, i.position, i.block_key, i.pillar, i.template_id, i.difficulty, i.time_limit_s,
      i.status, i.content, i.answer_key, resp.answer, resp.is_correct, resp.response_ms, i.outage_credit_ms
    from assessment_items i
    left join assessment_responses resp on resp.item_id = i.id
    where i.session_id = ${sessionId}
    order by i.position
  `;
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    blockKey: r.block_key,
    pillar: r.pillar,
    templateId: r.template_id,
    difficulty: r.difficulty,
    timeLimitS: r.time_limit_s,
    status: r.status,
    content: r.content,
    answerKey: r.answer_key,
    answer: r.answer,
    isCorrect: r.is_correct,
    responseMs: r.response_ms,
    outageCreditMs: r.outage_credit_ms,
  }));
}

export interface IntegrityEventRow {
  id: number;
  itemId: string | null;
  kind: string;
  at: Date;
  durationMs: number | null;
  meta: unknown;
}

export async function listIntegrityEvents(tx: TransactionSql, sessionId: string): Promise<IntegrityEventRow[]> {
  const rows = await tx<
    Array<{ id: number; item_id: string | null; kind: string; at: Date; duration_ms: number | null; meta: unknown }>
  >`
    select id, item_id, kind, at, duration_ms, meta
    from integrity_events where session_id = ${sessionId} order by at
  `;
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, kind: r.kind, at: r.at, durationMs: r.duration_ms, meta: r.meta }));
}

export interface NoteRow {
  id: string;
  authorId: string;
  authorName: string;
  kind: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listNotes(tx: TransactionSql, applicationId: string): Promise<NoteRow[]> {
  const rows = await tx<
    Array<{ id: string; author_id: string; author_name: string; kind: string; body: string; created_at: Date; updated_at: Date }>
  >`
    select n.id, n.author_id, au.display_name as author_name, n.kind, n.body, n.created_at, n.updated_at
    from admin_notes n join admin_users au on au.id = n.author_id
    where n.application_id = ${applicationId}
    order by n.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    kind: r.kind,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export interface StageHistoryRow {
  id: number;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

export async function listStageHistory(tx: TransactionSql, applicationId: string): Promise<StageHistoryRow[]> {
  const rows = await tx<
    Array<{
      id: number;
      from_stage: ApplicationStage | null;
      to_stage: ApplicationStage;
      changed_by_name: string | null;
      note: string | null;
      created_at: Date;
    }>
  >`
    select h.id, h.from_stage, h.to_stage, au.display_name as changed_by_name, h.note, h.created_at
    from application_stage_history h
    left join admin_users au on au.id = h.changed_by
    where h.application_id = ${applicationId}
    order by h.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    fromStage: r.from_stage,
    toStage: r.to_stage,
    changedByName: r.changed_by_name,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export interface ConsentRow {
  id: number;
  kind: string;
  textVersion: string;
  acceptedAt: Date;
}

export async function listConsents(tx: TransactionSql, applicationId: string): Promise<ConsentRow[]> {
  const rows = await tx<Array<{ id: number; kind: string; text_version: string; accepted_at: Date }>>`
    select id, kind, text_version, accepted_at from consents where application_id = ${applicationId} order by accepted_at
  `;
  return rows.map((r) => ({ id: r.id, kind: r.kind, textVersion: r.text_version, acceptedAt: r.accepted_at }));
}

export interface EmailRow {
  id: number;
  template: string;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}

export async function listEmails(tx: TransactionSql, applicationId: string): Promise<EmailRow[]> {
  const rows = await tx<
    Array<{ id: number; template: string; sent_at: Date | null; attempts: number; last_error: string | null; created_at: Date }>
  >`
    select id, template, sent_at, attempts, last_error, created_at
    from email_outbox where application_id = ${applicationId} order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    template: r.template,
    sentAt: r.sent_at,
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: r.created_at,
  }));
}
