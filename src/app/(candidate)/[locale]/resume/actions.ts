"use server";

import { otpRequestSchema, otpVerifySchema, resumeCodeSchema } from "@/lib/validation";
import { zodErrorsToRecord, type FieldErrors } from "@/lib/form-state";
import { normalizeEmail } from "@/lib/normalize";
import { normalizeResumeCodeInput } from "@/lib/resume-code";
import { withSystem } from "@/db/postgres";
import { consumeRateLimit, otpRateLimitKey, RATE_LIMITS, resumeRateLimitKey } from "@/lib/rate-limit";
import { requestOtp, resumeWithCode, verifyOtp } from "@/db/queries/application-flow";
import { setCandidateCookie } from "@/lib/candidate-session";
import { stepPath } from "@/lib/application-guard";
import { redirect } from "@/i18n/navigation";

// CANDIDATE_FLOW.md §2.4 / DECISIONS_LOG.md #2: /resume works with email +
// resume code (no email delivery required) or, as a fallback, email OTP.
// Both paths are rate-limited (5 resume attempts / email / hour; 3 OTP
// requests / email / hour).
//
// NOTE: the `initial*State` constants for each form live in resume-form.tsx,
// not here — a "use server" module may only export async functions; Next.js
// turns any other export (like a shared initial-state object) into
// `undefined` when a client component imports it across the boundary.

export interface ResumeCodeState {
  errors: FieldErrors;
  formError: string | null;
}
export async function resumeWithCodeAction(
  _prevState: ResumeCodeState,
  formData: FormData,
): Promise<ResumeCodeState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = resumeCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error), formError: null };
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email.ok) {
    return { errors: { email: email.error }, formError: null };
  }
  const code = normalizeResumeCodeInput(parsed.data.code);

  const rateLimitOk = await withSystem(async (tx) => {
    const { allowed } = await consumeRateLimit(
      tx,
      resumeRateLimitKey(email.value),
      RATE_LIMITS.resume.limit,
      RATE_LIMITS.resume.windowSeconds,
    );
    return allowed;
  });
  if (!rateLimitOk) {
    return { errors: {}, formError: "יותר מדי ניסיונות. נסו שוב בעוד שעה, או בקשו קוד למייל." };
  }

  const result = await resumeWithCode(email.value, code);
  if (result.kind === "not_found") {
    return { errors: {}, formError: "האימייל או קוד החזרה שגויים" };
  }

  await setCandidateCookie(result.applicationId);
  return redirect({ href: stepPath(result.applicationId, result.currentStep), locale: "he" });
}

export interface OtpRequestState {
  errors: FieldErrors;
  sent: boolean;
  formError: string | null;
}
export async function requestOtpAction(
  _prevState: OtpRequestState,
  formData: FormData,
): Promise<OtpRequestState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = otpRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error), sent: false, formError: null };
  }
  const email = normalizeEmail(parsed.data.email);
  if (!email.ok) {
    return { errors: { email: email.error }, sent: false, formError: null };
  }

  const rateLimitOk = await withSystem(async (tx) => {
    const { allowed } = await consumeRateLimit(
      tx,
      otpRateLimitKey(email.value),
      RATE_LIMITS.otp.limit,
      RATE_LIMITS.otp.windowSeconds,
    );
    return allowed;
  });
  if (!rateLimitOk) {
    return { errors: {}, sent: false, formError: "יותר מדי בקשות קוד. נסו שוב בעוד שעה." };
  }

  const result = await requestOtp(email.value);
  // Deliberately the same response whether or not an account exists, so
  // /resume never confirms which emails have applied.
  void result;
  return { errors: {}, sent: true, formError: null };
}

export interface OtpVerifyState {
  errors: FieldErrors;
  formError: string | null;
}
export async function verifyOtpAction(
  _prevState: OtpVerifyState,
  formData: FormData,
): Promise<OtpVerifyState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = otpVerifySchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error), formError: null };
  }
  const email = normalizeEmail(parsed.data.email);
  if (!email.ok) {
    return { errors: { email: email.error }, formError: null };
  }

  const result = await verifyOtp(email.value, parsed.data.code.trim());
  if (result.kind === "expired") {
    return { errors: {}, formError: "הקוד פג תוקף, יש לבקש קוד חדש" };
  }
  if (result.kind === "invalid") {
    return { errors: {}, formError: "הקוד שגוי" };
  }

  await setCandidateCookie(result.applicationId);
  return redirect({ href: stepPath(result.applicationId, result.currentStep), locale: "he" });
}
