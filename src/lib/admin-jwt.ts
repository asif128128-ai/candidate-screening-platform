import { jwtVerify } from "jose";

// ARCHITECTURE.md §6 / ADMIN_UX.md §8: admin auth is Supabase Auth (email +
// password, magic link fallback) with mandatory TOTP MFA. The middleware
// gate must not do a network round-trip per request, so it verifies the
// session JWT *locally* with SUPABASE_JWT_SECRET (HS256, the algorithm
// Supabase issues project JWTs with) instead of calling
// `supabase.auth.getUser()`. This module holds that verification plus the
// @supabase/ssr cookie-value parsing, shared by src/middleware.ts (Edge
// runtime — hence `jose`, which uses WebCrypto, not `jsonwebtoken`) and
// src/lib/current-admin.ts (Node runtime, Server Components/Actions).
//
// This is a *local signature/claims* check only. It proves the cookie was
// issued by our Supabase project and hasn't expired or been tampered with;
// it does NOT prove the admin_users allowlist row still exists and is
// enabled (Supabase doesn't know about that table) — that second check
// happens in src/lib/current-admin.ts against Postgres, in `system`
// context (see the comment there for why `system`, not `admin`, is used
// for that one lookup).

// We pin an explicit cookie name (rather than relying on @supabase/ssr's
// default `sb-<project-ref>-auth-token`, which is derived by parsing
// SUPABASE_URL) so the cookie name is stable and independent of the
// Supabase project URL shape — useful for local/dev Postgres-only testing
// where SUPABASE_URL isn't a real project.
export const ADMIN_AUTH_COOKIE_NAME = "sb-admin-auth-token";
const BASE64_PREFIX = "base64-";

export interface AdminJwtClaims {
  email: string;
  aal: "aal1" | "aal2";
  sub: string;
  exp: number;
}

interface StoredSupabaseSession {
  access_token?: string;
}

/**
 * @supabase/ssr stores the session as JSON, optionally prefixed with
 * "base64-" and base64url-encoded (its default `cookieEncoding`). Returns
 * the raw access_token JWT string, or null if the cookie is absent/
 * malformed.
 */
export function extractAccessTokenFromCookieValue(
  rawCookieValue: string | undefined,
): string | null {
  if (!rawCookieValue) return null;
  try {
    let json = rawCookieValue;
    if (rawCookieValue.startsWith(BASE64_PREFIX)) {
      const b64 = rawCookieValue.slice(BASE64_PREFIX.length);
      json = Buffer.from(b64, "base64url").toString("utf8");
    }
    const parsed = JSON.parse(json) as StoredSupabaseSession;
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifies a Supabase access-token JWT's signature and expiry locally with
 * SUPABASE_JWT_SECRET (HS256) and returns its admin-relevant claims, or
 * null if invalid/expired/malformed. Does not check the `admin_users`
 * allowlist — see module comment.
 */
export async function verifyAdminAccessToken(
  token: string,
  jwtSecret: string,
): Promise<AdminJwtClaims | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ["HS256"] },
    );
    const email = typeof payload.email === "string" ? payload.email : null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const aal =
      typeof payload.aal === "string" && (payload.aal === "aal1" || payload.aal === "aal2")
        ? payload.aal
        : "aal1";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (!email || !sub) return null;
    return { email, aal, sub, exp };
  } catch {
    return null;
  }
}
