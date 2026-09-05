"use server";

import { headers } from "next/headers";
import { personalDetailsSchema } from "@/lib/validation";
import { zodErrorsToRecord, type FieldErrors } from "@/lib/form-state";
import {
  normalizeEmail,
  normalizeGithubUrl,
  normalizeLinkedinUrl,
  normalizePhone,
  validateAcademicAverage,
  validateDateOfBirth,
} from "@/lib/normalize";
import { getClientIp, truncateIp } from "@/lib/ip";
import { withSystem } from "@/db/postgres";
import { consumeRateLimit, RATE_LIMITS, signupRateLimitKey } from "@/lib/rate-limit";
import { submitPersonalDetails, type PendingCvInput } from "@/db/queries/application-flow";
import { setCandidateCookie } from "@/lib/candidate-session";
import { formatResumeCodeForDisplay } from "@/lib/resume-code";

export interface PersonalDetailsActionState {
  errors: FieldErrors;
  formError: string | null;
  outcome:
    | null
    | { kind: "already_completed"; responseByDateHe: string; jobTitle: string }
    | { kind: "redirect_to_resume"; email: string }
    | {
        kind: "created";
        applicationId: string;
        resumeCodeDisplay: string;
        jobTitle: string;
        responseByDateHe: string;
        cvAttached: boolean;
        cvError: string | null;
      };
}

// NOTE: no plain-value exports below this point. A "use server" module may
// only export async functions — Next.js silently turns any other export
// (e.g. a shared `initialState` object constant) into `undefined` when a
// client component imports it across the boundary. The `initial*State`
// constants for each of this app's forms therefore live in their client
// component files instead, typed against the `*State` types exported here.

export async function submitPersonalDetailsAction(
  jobSlug: string,
  _prevState: PersonalDetailsActionState,
  formData: FormData,
): Promise<PersonalDetailsActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = personalDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error), formError: null, outcome: null };
  }
  const data = parsed.data;

  const errors: FieldErrors = {};

  const phone = normalizePhone(data.phone);
  if (!phone.ok) errors.phone = phone.error;

  const email = normalizeEmail(data.email);
  if (!email.ok) errors.email = email.error;

  const dob = validateDateOfBirth(data.dateOfBirth);
  if (!dob.ok) errors.dateOfBirth = dob.error;

  const average = validateAcademicAverage(data.academicAverage);
  if (!average.ok) errors.academicAverage = average.error;

  const linkedin = normalizeLinkedinUrl(data.linkedinUrl ?? "");
  if (!linkedin.ok) errors.linkedinUrl = linkedin.error;

  const github = normalizeGithubUrl(data.githubUrl ?? "");
  if (!github.ok) errors.githubUrl = github.error;

  if (Object.keys(errors).length > 0) {
    return { errors, formError: null, outcome: null };
  }
  if (!phone.ok || !email.ok || !dob.ok || !average.ok || !linkedin.ok || !github.ok) {
    // Unreachable given the check above, but narrows types for TS.
    return { errors, formError: "שגיאה בלתי צפויה, נסו שוב", outcome: null };
  }

  const headerList = await headers();
  const rawIp = getClientIp(headerList);
  const ipPrefix = rawIp ? truncateIp(rawIp) : null;
  const userAgent = headerList.get("user-agent");

  // CANDIDATE_FLOW.md §2.2: 5 signups / IP-prefix / hour.
  const rateLimitOk = await withSystem(async (tx) => {
    const key = signupRateLimitKey(ipPrefix ?? "unknown");
    const { allowed } = await consumeRateLimit(tx, key, RATE_LIMITS.signup.limit, RATE_LIMITS.signup.windowSeconds);
    return allowed;
  });
  if (!rateLimitOk) {
    return {
      errors: {},
      formError: "יותר מדי ניסיונות הגשה מכתובת זו. נסו שוב בעוד שעה.",
      outcome: null,
    };
  }

  let pendingCv: PendingCvInput | null = null;
  if (data.pendingCvId) {
    try {
      pendingCv = JSON.parse(data.pendingCvId) as PendingCvInput;
    } catch {
      pendingCv = null;
    }
  }

  const result = await submitPersonalDetails({
    jobSlug,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: dob.value,
    phoneE164: phone.value,
    emailNormalized: email.value,
    institution: data.institution,
    degreeProgram: data.degreeProgram,
    studyYear: data.studyYear,
    academicAverage: average.value,
    canWorkRishon: data.canWorkRishon === "yes",
    linkedinUrl: linkedin.value,
    githubUrl: github.value,
    pendingCv,
    ipPrefix,
    userAgent,
  });

  if (result.kind === "job_not_found") {
    return { errors: {}, formError: "המשרה אינה קיימת או שאינה פעילה כרגע", outcome: null };
  }
  if (result.kind === "already_completed") {
    return {
      errors: {},
      formError: null,
      outcome: {
        kind: "already_completed",
        responseByDateHe: result.responseByDate.toLocaleDateString("he-IL"),
        jobTitle: result.jobTitle,
      },
    };
  }
  if (result.kind === "redirect_to_resume") {
    return { errors: {}, formError: null, outcome: { kind: "redirect_to_resume", email: result.email } };
  }

  await setCandidateCookie(result.applicationId);

  return {
    errors: {},
    formError: null,
    outcome: {
      kind: "created",
      applicationId: result.applicationId,
      resumeCodeDisplay: formatResumeCodeForDisplay(result.resumeCode),
      jobTitle: result.jobTitle,
      responseByDateHe: result.responseByDate.toLocaleDateString("he-IL"),
      cvAttached: result.cvAttached,
      cvError: result.cvError,
    },
  };
}
