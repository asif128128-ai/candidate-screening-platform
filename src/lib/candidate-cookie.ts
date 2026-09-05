import { createHmac, timingSafeEqual } from "node:crypto";

// ARCHITECTURE.md §6: `app_session` = base64url(application_id ‖
// HMAC-SHA256(application_id, secret)), httpOnly, Secure, SameSite=Lax,
// path "/", max-age 14 days. This module only does the sign/verify math;
// TODO(candidate-flow engineer): wire this into an actual `Set-Cookie` /
// cookie-read helper (e.g. via `next/headers`), the /apply/* route guard
// that 404s on an application_id mismatch, and the /resume re-issue flow
// (CANDIDATE_FLOW.md §2.4).

export const CANDIDATE_COOKIE_NAME = "app_session";
export const CANDIDATE_COOKIE_MAX_AGE_S = 14 * 24 * 60 * 60; // 14 days

const SEPARATOR = Buffer.from([0]); // NUL — application_id is a UUID, never contains NUL

function sign(applicationId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(applicationId).digest();
}

export function createCandidateCookieValue(
  applicationId: string,
  secret: string,
): string {
  const mac = sign(applicationId, secret);
  const payload = Buffer.concat([
    Buffer.from(applicationId, "utf8"),
    SEPARATOR,
    mac,
  ]);
  return payload.toString("base64url");
}

/** Returns the application_id if the cookie is well-formed and the HMAC checks out, else null. */
export function verifyCandidateCookieValue(
  cookieValue: string,
  secret: string,
): string | null {
  let payload: Buffer;
  try {
    payload = Buffer.from(cookieValue, "base64url");
  } catch {
    return null;
  }
  const sep = payload.indexOf(0);
  if (sep === -1) return null;
  const applicationId = payload.subarray(0, sep).toString("utf8");
  const mac = payload.subarray(sep + 1);
  const expected = sign(applicationId, secret);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    return null;
  }
  return applicationId;
}
