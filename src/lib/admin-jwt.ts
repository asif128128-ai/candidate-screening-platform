// Deep import (not the `jose` barrel) so bundlers only pull in the JWS
// verification path — the barrel re-exports JWE code too, which uses
// CompressionStream/DecompressionStream and isn't available in the Edge
// Runtime this file runs in (src/middleware.ts). We never use JWE.
import { jwtVerify, type JWTVerifyGetKey } from "jose/jwt/verify";
import { createRemoteJWKSet } from "jose/jwks/remote";

// ARCHITECTURE.md §6 / ADMIN_UX.md §8: admin auth is Supabase Auth (email +
// password, magic link fallback) with mandatory TOTP MFA. The middleware
// gate must not do a DB round-trip per request, so it verifies the session
// JWT *locally* instead of calling `supabase.auth.getUser()`. This module
// holds that verification plus the @supabase/ssr cookie-value parsing,
// shared by src/middleware.ts (Edge runtime — hence `jose`, which uses
// WebCrypto, not `jsonwebtoken`) and src/lib/current-admin.ts (Node
// runtime, Server Components/Actions).
//
// Verification is against the project's public JWKS
// (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), not a shared HMAC
// secret: as of late 2026, new Supabase projects default to asymmetric
// (ES256) JWT signing, with the legacy shared HS256 secret already showing
// as "previously_used" the moment a project is created (verified directly
// against a freshly-created project's `config/auth/signing-keys` — see
// IMPLEMENTATION_NOTES.md "deployment" section). The original design here
// assumed the legacy shared-secret scheme; that assumption no longer holds
// for new projects, so admin login would silently fail signature
// verification with the old code. JWKS verification is correct for both
// schemes going forward (Supabase publishes whichever key is actually
// active), needs no secret at all, and jose's `createRemoteJWKSet` caches
// the fetched key set in-memory (safe to call once per process — see the
// module-level singleton below — Edge runtime supports `fetch`, so this
// costs nothing extra beyond ordinary key rotation lookups). A legacy
// project whose JWKS endpoint has no keys published at all (fully old-style
// HS256-only) falls back to `SUPABASE_JWT_SECRET`, if set, so this remains
// backward compatible.
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

// One JWKS resolver per Supabase URL for the life of the process — jose's
// `createRemoteJWKSet` already caches fetched keys internally (and
// automatically re-fetches on a `kid` miss, e.g. after key rotation); this
// map just avoids constructing a fresh resolver (and losing that cache) on
// every request.
const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwks(supabaseUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl));
    jwksCache.set(supabaseUrl, jwks);
  }
  return jwks;
}

function claimsFromPayload(payload: Record<string, unknown>): AdminJwtClaims | null {
  const email = typeof payload.email === "string" ? payload.email : null;
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const aal =
    typeof payload.aal === "string" && (payload.aal === "aal1" || payload.aal === "aal2")
      ? payload.aal
      : "aal1";
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (!email || !sub) return null;
  return { email, aal, sub, exp };
}

/**
 * Verifies a Supabase access-token JWT's signature and expiry locally
 * against the project's public JWKS (falling back to the legacy shared
 * HS256 secret, if provided, for a fully old-style project) and returns
 * its admin-relevant claims, or null if invalid/expired/malformed. Does
 * not check the `admin_users` allowlist — see module comment.
 */
export async function verifyAdminAccessToken(
  token: string,
  options: { supabaseUrl: string; legacyJwtSecret?: string },
): Promise<AdminJwtClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(options.supabaseUrl));
    return claimsFromPayload(payload);
  } catch {
    // Fall through to the legacy secret below only on a genuine JWKS/
    // verification failure — an expired-but-otherwise-valid token should
    // not be "rescued" into passing some other way, but jwtVerify already
    // throws for expiry too, and legacy verification below re-checks it
    // independently, so this stays correct either way.
  }
  if (!options.legacyJwtSecret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(options.legacyJwtSecret),
      { algorithms: ["HS256"] },
    );
    return claimsFromPayload(payload);
  } catch {
    return null;
  }
}
