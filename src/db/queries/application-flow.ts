import { randomUUID } from "node:crypto";
import { withCandidate, withSystem } from "@/db/postgres";
import { decideDuplicateOutcome, type SameJobApplicationSignal } from "@/lib/duplicate-detection";
import {
  formatResumeCodeForDisplay,
  generateResumeCode,
  hashResumeCode,
  verifyResumeCode,
} from "@/lib/resume-code";
import {
  ASSESSMENT_MONITORING_V1_TEXT_HASH,
  CONSENT_KINDS,
  PRIVACY_V1_TEXT_HASH,
} from "@/lib/consent-text";
import { enqueueEmail, sendQueuedEmailBestEffort } from "@/lib/email/send";
import { finalizeCvObject } from "@/lib/cv-storage";
import type { CvKind } from "@/lib/cv-validation";
import { loadEnv } from "@/lib/env";

// ARCHITECTURE.md §5.1 / CANDIDATE_FLOW.md §2: all the DB-touching logic
// behind step 1 (submitPersonalDetails), step 2 (confirmJobUnderstanding),
// step 3 consent, done-page info, and /resume. See
// IMPLEMENTATION_NOTES.md "RLS/FK ordering for the first candidate+
// application insert" for why `submitPersonalDetails` and the /resume
// lookups run in `system` context rather than `candidate` context.

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface PendingCvInput {
  pendingPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hex: string;
  kind: CvKind;
}

export interface SubmitPersonalDetailsInput {
  jobSlug: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phoneE164: string;
  emailNormalized: string;
  institution: string;
  degreeProgram: string;
  studyYear: number;
  academicAverage: number;
  canWorkRishon: boolean;
  linkedinUrl: string | null;
  githubUrl: string | null;
  pendingCv: PendingCvInput | null;
  ipPrefix: string | null;
  userAgent: string | null;
}

export type SubmitPersonalDetailsResult =
  | { kind: "job_not_found" }
  | { kind: "already_completed"; responseByDate: Date; jobTitle: string }
  | { kind: "redirect_to_resume"; email: string }
  | {
      kind: "created";
      applicationId: string;
      resumeCode: string;
      jobTitle: string;
      responseByDate: Date;
      cvAttached: boolean;
      cvError: string | null;
    };

export async function submitPersonalDetails(
  input: SubmitPersonalDetailsInput,
): Promise<SubmitPersonalDetailsResult> {
  const outcome = await withSystem(async (tx) => {
    const jobRows = await tx<
      { id: string; title_he: string; response_window_days: number }[]
    >`select id, title_he, response_window_days from jobs where slug = ${input.jobSlug} and is_active limit 1`;
    const job = jobRows[0];
    if (!job) return { kind: "job_not_found" as const };

    const candidateRows = await tx<{ id: string }[]>`
      select id from candidates where email = ${input.emailNormalized} limit 1
    `;
    const existingCandidateId = candidateRows[0]?.id ?? null;

    let sameJobSignal: SameJobApplicationSignal | null = null;
    if (existingCandidateId) {
      const appRows = await tx<
        { application_id: string; created_at: Date; status: string | null }[]
      >`
        select a.id as application_id, a.created_at, s.status
        from applications a
        left join assessment_sessions s on s.application_id = a.id
        where a.candidate_id = ${existingCandidateId} and a.job_id = ${job.id}
        limit 1
      `;
      const existingApp = appRows[0];
      if (existingApp) {
        sameJobSignal = {
          applicationId: existingApp.application_id,
          completed: existingApp.status === "completed",
          responseByDate: addDays(existingApp.created_at, job.response_window_days),
        };
      }
    }

    const phoneMatchRows = await tx<{ id: string }[]>`
      select id from candidates
      where phone_e164 = ${input.phoneE164} and id is distinct from ${existingCandidateId}
      limit 1
    `;
    const phoneMatchCandidateId = phoneMatchRows[0]?.id ?? null;

    const decision = decideDuplicateOutcome(input.emailNormalized, sameJobSignal, phoneMatchCandidateId);

    if (decision.kind === "already_completed") {
      return { kind: "already_completed" as const, responseByDate: decision.responseByDate, jobTitle: job.title_he };
    }
    if (decision.kind === "redirect_to_resume") {
      return { kind: "redirect_to_resume" as const, email: decision.prefillEmail };
    }

    // decision.kind === "create_new"
    const candidateId = existingCandidateId ?? randomUUID();
    await tx`
      insert into candidates (
        id, email, phone_e164, first_name, last_name, date_of_birth, institution,
        degree_program, study_year, academic_average, linkedin_url, github_url, ip_prefix
      ) values (
        ${candidateId}, ${input.emailNormalized}, ${input.phoneE164}, ${input.firstName}, ${input.lastName},
        ${input.dateOfBirth.toISOString().slice(0, 10)}, ${input.institution}, ${input.degreeProgram},
        ${input.studyYear}, ${input.academicAverage}, ${input.linkedinUrl}, ${input.githubUrl}, ${input.ipPrefix}
      )
      on conflict (email) do update set
        phone_e164 = excluded.phone_e164,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        date_of_birth = excluded.date_of_birth,
        institution = excluded.institution,
        degree_program = excluded.degree_program,
        study_year = excluded.study_year,
        academic_average = excluded.academic_average,
        linkedin_url = excluded.linkedin_url,
        github_url = excluded.github_url,
        updated_at = now()
    `;

    const applicationId = randomUUID();
    const resumeCode = generateResumeCode();
    const resumeCodeHash = hashResumeCode(resumeCode);

    const insertedApp = await tx<{ created_at: Date }[]>`
      insert into applications (
        id, candidate_id, job_id, can_work_rishon, resume_code_hash, duplicate_phone_of, user_agent_signup
      ) values (
        ${applicationId}, ${candidateId}, ${job.id}, ${input.canWorkRishon}, ${resumeCodeHash},
        ${decision.duplicatePhoneOfCandidateId}, ${input.userAgent}
      )
      returning created_at
    `;
    const createdAt = insertedApp[0]!.created_at;

    await tx`
      insert into consents (application_id, kind, text_version, ip_prefix)
      values (${applicationId}, ${CONSENT_KINDS.privacy}, ${PRIVACY_V1_TEXT_HASH}, ${input.ipPrefix})
    `;

    const responseByDate = addDays(createdAt, job.response_window_days);

    return {
      kind: "created" as const,
      applicationId,
      resumeCode,
      jobTitle: job.title_he,
      responseByDate,
      candidateEmail: input.emailNormalized,
      candidateFirstName: input.firstName,
    };
  });

  if (outcome.kind !== "created") return outcome;

  let cvAttached = false;
  let cvError: string | null = null;
  if (input.pendingCv) {
    try {
      await attachCvToApplication(outcome.applicationId, input.pendingCv);
      cvAttached = true;
    } catch (err) {
      cvError = err instanceof Error ? err.message : "כישלון בצירוף קובץ קורות החיים";
      console.error(
        JSON.stringify({ event: "cv_attach_failed", applicationId: outcome.applicationId, error: cvError }),
      );
    }
  }

  // Enqueue + best-effort send the confirmation email (ARCHITECTURE.md §8:
  // email failures never block the candidate flow — the row above is
  // already committed regardless of what happens next).
  try {
    const env = loadEnv();
    const outboxId = await withSystem((tx) =>
      enqueueEmail(tx, {
        toEmail: outcome.candidateEmail,
        template: "application_received",
        payload: {
          firstName: outcome.candidateFirstName,
          jobTitle: outcome.jobTitle,
          resumeCodeDisplay: formatResumeCodeForDisplay(outcome.resumeCode),
          resumeUrl: `${env.APP_BASE_URL}/resume`,
          responseByDateHe: outcome.responseByDate.toLocaleDateString("he-IL"),
        },
        applicationId: outcome.applicationId,
      }),
    );
    void sendQueuedEmailBestEffort(outboxId);
  } catch (err) {
    console.error(JSON.stringify({ event: "enqueue_application_received_failed", error: String(err) }));
  }

  return {
    kind: "created",
    applicationId: outcome.applicationId,
    resumeCode: outcome.resumeCode,
    jobTitle: outcome.jobTitle,
    responseByDate: outcome.responseByDate,
    cvAttached,
    cvError,
  };
}

async function attachCvToApplication(applicationId: string, pending: PendingCvInput): Promise<void> {
  const finalPath = await finalizeCvObject(pending.pendingPath, applicationId, pending.kind);
  const sha256Buffer = Buffer.from(pending.sha256Hex, "hex");
  await withCandidate(applicationId, async (tx) => {
    await tx`
      select * from cv_upsert(
        ${applicationId}, ${finalPath}, ${pending.originalName}, ${pending.mimeType}, ${pending.sizeBytes}, ${sha256Buffer}
      )
    `;
  });
}

export type ApplicationStep = "job" | "briefing" | "assessment" | "done";

export interface ApplicationRoutingState {
  applicationId: string;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  responseWindowDays: number;
  candidateFirstName: string;
  createdAt: Date;
  jobConfirmedAt: Date | null;
  canWorkRishon: boolean;
  monitoringConsentGiven: boolean;
  sessionStatus: "in_progress" | "completed" | "abandoned" | null;
  currentStep: ApplicationStep;
}

function computeCurrentStep(
  jobConfirmedAt: Date | null,
  sessionStatus: string | null,
): ApplicationStep {
  if (sessionStatus === "completed" || sessionStatus === "abandoned") return "done";
  if (sessionStatus === "in_progress") return "assessment";
  if (jobConfirmedAt) return "briefing";
  return "job";
}

export async function getApplicationRoutingState(
  applicationId: string,
): Promise<ApplicationRoutingState | null> {
  return withCandidate(applicationId, async (tx) => {
    const rows = await tx<
      {
        job_id: string;
        job_slug: string;
        job_title: string;
        response_window_days: number;
        first_name: string;
        created_at: Date;
        job_confirmed_at: Date | null;
        can_work_rishon: boolean;
        session_status: string | null;
      }[]
    >`
      select a.job_id, j.slug as job_slug, j.title_he as job_title, j.response_window_days,
             c.first_name, a.created_at, a.job_confirmed_at, a.can_work_rishon, s.status as session_status
      from applications a
      join jobs j on j.id = a.job_id
      join candidates c on c.id = a.candidate_id
      left join assessment_sessions s on s.application_id = a.id
      where a.id = ${applicationId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;

    const consentRows = await tx<{ count: string }[]>`
      select count(*)::text as count from consents
      where application_id = ${applicationId} and kind = ${CONSENT_KINDS.assessmentMonitoring}
    `;
    const monitoringConsentGiven = Number(consentRows[0]?.count ?? "0") > 0;

    return {
      applicationId,
      jobId: row.job_id,
      jobSlug: row.job_slug,
      jobTitle: row.job_title,
      responseWindowDays: row.response_window_days,
      candidateFirstName: row.first_name,
      createdAt: row.created_at,
      jobConfirmedAt: row.job_confirmed_at,
      canWorkRishon: row.can_work_rishon,
      monitoringConsentGiven,
      sessionStatus: (row.session_status as "in_progress" | "completed" | "abandoned" | null) ?? null,
      currentStep: computeCurrentStep(row.job_confirmed_at, row.session_status),
    };
  });
}

export async function confirmJobUnderstanding(applicationId: string): Promise<void> {
  await withCandidate(applicationId, async (tx) => {
    await tx`
      update applications set job_confirmed_at = coalesce(job_confirmed_at, now())
      where id = ${applicationId}
    `;
  });
}

export async function recordMonitoringConsent(
  applicationId: string,
  ipPrefix: string | null,
): Promise<void> {
  await withCandidate(applicationId, async (tx) => {
    const existing = await tx<{ count: string }[]>`
      select count(*)::text as count from consents
      where application_id = ${applicationId} and kind = ${CONSENT_KINDS.assessmentMonitoring}
    `;
    if (Number(existing[0]?.count ?? "0") === 0) {
      await tx`
        insert into consents (application_id, kind, text_version, ip_prefix)
        values (${applicationId}, ${CONSENT_KINDS.assessmentMonitoring}, ${ASSESSMENT_MONITORING_V1_TEXT_HASH}, ${ipPrefix})
      `;
    }
    await tx`
      update applications set briefing_seen_at = coalesce(briefing_seen_at, now())
      where id = ${applicationId}
    `;
  });
}

export interface DoneInfo {
  candidateFirstName: string;
  jobTitle: string;
  responseByDate: Date;
  sessionStatus: "in_progress" | "completed" | "abandoned" | null;
}

export async function getDoneInfo(applicationId: string): Promise<DoneInfo | null> {
  return withCandidate(applicationId, async (tx) => {
    const rows = await tx<
      {
        first_name: string;
        job_title: string;
        response_window_days: number;
        created_at: Date;
        session_status: string | null;
      }[]
    >`
      select c.first_name, j.title_he as job_title, j.response_window_days, a.created_at, s.status as session_status
      from applications a
      join jobs j on j.id = a.job_id
      join candidates c on c.id = a.candidate_id
      left join assessment_sessions s on s.application_id = a.id
      where a.id = ${applicationId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      candidateFirstName: row.first_name,
      jobTitle: row.job_title,
      responseByDate: addDays(row.created_at, row.response_window_days),
      sessionStatus: (row.session_status as "in_progress" | "completed" | "abandoned" | null) ?? null,
    };
  });
}

export type ResumeLookupResult =
  | { kind: "not_found" }
  | { kind: "found"; applicationId: string; currentStep: ApplicationStep };

/** CANDIDATE_FLOW.md §2.4: email + resume code, no cookie required yet — necessarily `system` context (see module doc comment). */
export async function resumeWithCode(
  emailNormalized: string,
  code: string,
): Promise<ResumeLookupResult> {
  return withSystem(async (tx) => {
    const rows = await tx<{ id: string; resume_code_hash: Buffer; job_confirmed_at: Date | null; status: string | null }[]>`
      select a.id, a.resume_code_hash, a.job_confirmed_at, s.status
      from applications a
      join candidates c on c.id = a.candidate_id
      left join assessment_sessions s on s.application_id = a.id
      where c.email = ${emailNormalized}
      order by a.created_at desc
    `;
    for (const row of rows) {
      if (verifyResumeCode(code, row.resume_code_hash)) {
        return {
          kind: "found",
          applicationId: row.id,
          currentStep: computeCurrentStep(row.job_confirmed_at, row.status),
        };
      }
    }
    return { kind: "not_found" };
  });
}

const OTP_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;

function generateOtpCode(): string {
  const n = Math.floor(Math.random() * 10 ** OTP_LENGTH);
  return n.toString().padStart(OTP_LENGTH, "0");
}

export type OtpRequestResult = { kind: "sent" } | { kind: "no_account" };

/**
 * CANDIDATE_FLOW.md §2.4 fallback path. Simplification (documented in
 * IMPLEMENTATION_NOTES.md "OTP storage"): targets the candidate's single
 * most recent application, since the seed data ships one active job and
 * multi-job disambiguation by OTP alone isn't specified.
 */
export async function requestOtp(emailNormalized: string): Promise<OtpRequestResult> {
  const code = generateOtpCode();
  const codeHash = hashResumeCode(code);

  const applicationId = await withSystem(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      select a.id from applications a
      join candidates c on c.id = a.candidate_id
      where c.email = ${emailNormalized}
      order by a.created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    await tx`
      update applications
        set otp_code_hash = ${codeHash},
            otp_expires_at = now() + make_interval(mins => ${OTP_EXPIRES_MINUTES}),
            otp_attempts = 0
        where id = ${row.id}
    `;
    return row.id;
  });

  if (!applicationId) return { kind: "no_account" };

  try {
    const outboxId = await withSystem((tx) =>
      enqueueEmail(tx, {
        toEmail: emailNormalized,
        template: "resume_otp",
        payload: { code, expiresMinutes: OTP_EXPIRES_MINUTES },
        applicationId,
      }),
    );
    void sendQueuedEmailBestEffort(outboxId);
  } catch (err) {
    console.error(JSON.stringify({ event: "enqueue_resume_otp_failed", error: String(err) }));
  }

  return { kind: "sent" };
}

export type OtpVerifyResult =
  | { kind: "ok"; applicationId: string; currentStep: ApplicationStep }
  | { kind: "invalid" }
  | { kind: "expired" };

export async function verifyOtp(emailNormalized: string, code: string): Promise<OtpVerifyResult> {
  return withSystem(async (tx) => {
    const rows = await tx<
      {
        id: string;
        otp_code_hash: Buffer | null;
        otp_expires_at: Date | null;
        job_confirmed_at: Date | null;
        status: string | null;
      }[]
    >`
      select a.id, a.otp_code_hash, a.otp_expires_at, a.job_confirmed_at, s.status
      from applications a
      join candidates c on c.id = a.candidate_id
      left join assessment_sessions s on s.application_id = a.id
      where c.email = ${emailNormalized}
      order by a.created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row || !row.otp_code_hash || !row.otp_expires_at) return { kind: "invalid" as const };
    if (row.otp_expires_at.getTime() < Date.now()) return { kind: "expired" as const };
    if (!verifyResumeCode(code, row.otp_code_hash)) {
      await tx`update applications set otp_attempts = otp_attempts + 1 where id = ${row.id}`;
      return { kind: "invalid" as const };
    }
    await tx`update applications set otp_code_hash = null, otp_expires_at = null where id = ${row.id}`;
    return {
      kind: "ok" as const,
      applicationId: row.id,
      currentStep: computeCurrentStep(row.job_confirmed_at, row.status),
    };
  });
}

export async function createPrivacyRequest(
  emailNormalized: string,
  kind: "access" | "delete" | "correct",
  note: string,
): Promise<void> {
  await withSystem(async (tx) => {
    await tx`
      insert into privacy_requests (email, kind, note)
      values (${emailNormalized}, ${kind}, ${note || null})
    `;
  });
}
