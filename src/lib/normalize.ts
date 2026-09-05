// CANDIDATE_FLOW.md §2.1: normalization rules for step-1 personal-details
// fields. Pure functions, no I/O, so they're unit-testable in isolation
// (TEST_STRATEGY.md §2 "Personal-details validation/normalization" row) and
// shared between client-side inline validation and the server action.

export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Normalizes an Israeli or generic E.164 phone number.
 * Accepts: `05X-XXXXXXX`, `05XXXXXXXX`, `+9725XXXXXXXX`, `9725XXXXXXXX`;
 * non-Israeli numbers are accepted if already valid E.164.
 * Output: E.164, e.g. `+9725XXXXXXXX`.
 */
export function normalizePhone(input: string): NormalizeResult<string> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "יש להזין מספר טלפון" };

  // Strip common separators (spaces, dashes, dots, parens) but keep a
  // leading "+" if present.
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { ok: false, error: "מספר טלפון לא תקין" };

  // Israeli local mobile: 05X-XXXXXXX / 05XXXXXXXX -> 10 digits starting "05".
  if (!hasPlus && /^05\d{8}$/.test(digits)) {
    const e164 = `+972${digits.slice(1)}`;
    return { ok: true, value: e164 };
  }

  // Israeli with country code, no plus: 9725XXXXXXXX (12 digits total).
  if (!hasPlus && /^9725\d{8}$/.test(digits)) {
    return { ok: true, value: `+${digits}` };
  }

  // Already E.164-shaped (with or without the "+" the user typed).
  const e164Candidate = hasPlus ? `+${digits}` : digits.startsWith("972") ? `+${digits}` : null;
  if (e164Candidate && /^\+[1-9]\d{7,14}$/.test(e164Candidate)) {
    return { ok: true, value: e164Candidate };
  }

  // Generic E.164 for non-Israeli numbers typed with a leading "+".
  if (hasPlus && /^\+[1-9]\d{7,14}$/.test(`+${digits}`)) {
    return { ok: true, value: `+${digits}` };
  }

  return { ok: false, error: "מספר טלפון לא תקין" };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercased, trimmed; RFC-shaped validation only (no MX check — ARCHITECTURE.md §1). */
export function normalizeEmail(input: string): NormalizeResult<string> {
  const value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "יש להזין כתובת אימייל" };
  if (value.length > 254 || !EMAIL_RE.test(value)) {
    return { ok: false, error: "כתובת אימייל לא תקינה" };
  }
  return { ok: true, value };
}

const LINKEDIN_USERNAME_RE = /^[a-zA-Z0-9\-_%.]{3,100}$/;

/** Normalizes to `https://www.linkedin.com/in/<username>`. Optional field. */
export function normalizeLinkedinUrl(input: string): NormalizeResult<string | null> {
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };

  const withoutProtocol = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const match = withoutProtocol.match(/^(?:www\.)?linkedin\.com\/in\/([^/?#]+)/i);
  const username = match ? match[1] : (LINKEDIN_USERNAME_RE.test(raw) ? raw : null);

  if (!username || !LINKEDIN_USERNAME_RE.test(username)) {
    return { ok: false, error: "קישור LinkedIn לא תקין" };
  }
  return { ok: true, value: `https://www.linkedin.com/in/${username}` };
}

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Normalizes to `https://github.com/<user>`; bare username accepted. */
export function normalizeGithubUrl(input: string): NormalizeResult<string | null> {
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };

  const withoutProtocol = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const match = withoutProtocol.match(/^(?:www\.)?github\.com\/([^/?#]+)/i);
  const username = match ? match[1] : withoutProtocol;

  if (!username || !GITHUB_USERNAME_RE.test(username)) {
    return { ok: false, error: "קישור GitHub לא תקין" };
  }
  return { ok: true, value: `https://github.com/${username}` };
}

/** Age in whole years, as of `asOf` (defaults to now). Never used in scoring. */
export function ageInYears(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = asOf.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

/** CANDIDATE_FLOW.md §2.1: date of birth must be 16-70 years ago, sanity only. */
export function validateDateOfBirth(dateOfBirth: Date, asOf: Date = new Date()): NormalizeResult<Date> {
  if (Number.isNaN(dateOfBirth.getTime())) {
    return { ok: false, error: "תאריך לידה לא תקין" };
  }
  const age = ageInYears(dateOfBirth, asOf);
  if (age < 16 || age > 70) {
    return { ok: false, error: "תאריך הלידה חייב להתאים לגיל בין 16 ל-70" };
  }
  return { ok: true, value: dateOfBirth };
}

/** 0-100, one decimal place. */
export function validateAcademicAverage(input: number): NormalizeResult<number> {
  if (Number.isNaN(input) || input < 0 || input > 100) {
    return { ok: false, error: "הממוצע חייב להיות בין 0 ל-100" };
  }
  const rounded = Math.round(input * 10) / 10;
  return { ok: true, value: rounded };
}
