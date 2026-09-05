import { cookies } from "next/headers";
import {
  CANDIDATE_COOKIE_MAX_AGE_S,
  CANDIDATE_COOKIE_NAME,
  createCandidateCookieValue,
  verifyCandidateCookieValue,
} from "./candidate-cookie";
import { loadEnv } from "./env";

// ARCHITECTURE.md §6: wires the pure sign/verify helpers in
// candidate-cookie.ts into real `next/headers` cookie read/write, for
// application-flow session continuity (steps 1-3, resume, done — NOT the
// assessment timer hot path, which is the assessment-engine engineer's).

/** Sets the signed `app_session` cookie for `applicationId`. Call from a Server Action after creating/resuming an application. */
export async function setCandidateCookie(applicationId: string): Promise<void> {
  const env = loadEnv();
  const value = createCandidateCookieValue(applicationId, env.CANDIDATE_COOKIE_SECRET);
  const store = await cookies();
  store.set(CANDIDATE_COOKIE_NAME, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CANDIDATE_COOKIE_MAX_AGE_S,
  });
}

/** Reads and verifies the candidate cookie; returns the application_id or null if absent/invalid. */
export async function getCandidateApplicationId(): Promise<string | null> {
  const env = loadEnv();
  const store = await cookies();
  const raw = store.get(CANDIDATE_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifyCandidateCookieValue(raw, env.CANDIDATE_COOKIE_SECRET);
}

export async function clearCandidateCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CANDIDATE_COOKIE_NAME);
}

export type CookieCheckResult =
  | { kind: "missing" }
  | { kind: "mismatch" }
  | { kind: "ok"; applicationId: string };

/**
 * CANDIDATE_FLOW.md §1 / §8: every `/apply/{applicationId}/*` route checks
 * the cookie against the URL. No cookie at all -> redirect to `/resume`
 * (§8). Cookie present but for a *different* application -> 404 (§1,
 * "mismatch -> 404" — this is not information-leaking since both branches
 * are indistinguishable to someone without a valid cookie for either id).
 */
export async function checkCandidateCookie(urlApplicationId: string): Promise<CookieCheckResult> {
  const applicationId = await getCandidateApplicationId();
  if (!applicationId) return { kind: "missing" };
  if (applicationId !== urlApplicationId) return { kind: "mismatch" };
  return { kind: "ok", applicationId };
}
