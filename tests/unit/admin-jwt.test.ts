import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import {
  extractAccessTokenFromCookieValue,
  verifyAdminAccessToken,
} from "@/lib/admin-jwt";

const SECRET = "test-secret-at-least-32-chars-long-ok";

// No real Supabase project reachable in unit tests — an unreachable host
// makes JWKS lookup fail fast (connection refused, not a timeout) and fall
// through to the legacy secret path, which is what these tests exercise.
// See admin-jwt.ts's module comment for why JWKS is the primary path now
// and this fallback exists.
const UNREACHABLE_SUPABASE_URL = "http://127.0.0.1:1";

async function sign(claims: Record<string, unknown>, expiresIn = "1h"): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject((claims.sub as string) ?? "00000000-0000-0000-0000-000000000001")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(SECRET));
}

function cookieValueFor(accessToken: string): string {
  const session = { access_token: accessToken };
  return "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function verify(token: string, legacyJwtSecret: string | undefined = SECRET) {
  return verifyAdminAccessToken(token, {
    supabaseUrl: UNREACHABLE_SUPABASE_URL,
    legacyJwtSecret,
  });
}

// This is the security-critical logic behind src/middleware.ts's admin gate
// (ARCHITECTURE.md §6: "verify the session JWT locally ... require aal2").
// Pure and dependency-free enough to unit test exhaustively without a
// browser or a live Supabase project — the JWKS-verification path itself
// needs a real project's public key set, so it's covered separately by
// manual verification against the actual deployed project rather than a
// unit test (see IMPLEMENTATION_NOTES.md); what's tested here is the claims
// extraction/validation logic, identical on both the JWKS and legacy paths
// (`claimsFromPayload`), plus the fallback behavior itself.

describe("extractAccessTokenFromCookieValue", () => {
  test("decodes the base64- prefixed JSON @supabase/ssr stores", () => {
    const value = cookieValueFor("my-jwt");
    expect(extractAccessTokenFromCookieValue(value)).toBe("my-jwt");
  });

  test("returns null for missing/malformed/non-JSON cookies", () => {
    expect(extractAccessTokenFromCookieValue(undefined)).toBeNull();
    expect(extractAccessTokenFromCookieValue("not base64 json at all")).toBeNull();
    expect(extractAccessTokenFromCookieValue("base64-" + Buffer.from("{not json").toString("base64url"))).toBeNull();
  });

  test("returns null when the session JSON has no access_token", () => {
    const value = "base64-" + Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(extractAccessTokenFromCookieValue(value)).toBeNull();
  });
});

describe("verifyAdminAccessToken (legacy HS256 fallback path — JWKS unreachable)", () => {
  test("accepts a validly-signed aal2 token and returns its claims", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" });
    const claims = await verify(token);
    expect(claims).toMatchObject({ email: "admin@example.co.il", aal: "aal2" });
  });

  test("defaults aal to aal1 when the claim is missing (never trust-by-default to aal2)", async () => {
    const token = await sign({ email: "admin@example.co.il" });
    const claims = await verify(token);
    expect(claims?.aal).toBe("aal1");
  });

  test("rejects a token signed with the wrong secret", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" });
    const claims = await verify(token, "a-completely-different-secret-value");
    expect(claims).toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" }, "-1s");
    const claims = await verify(token);
    expect(claims).toBeNull();
  });

  test("rejects a token with no email claim", async () => {
    const token = await sign({ aal: "aal2" });
    const claims = await verify(token);
    expect(claims).toBeNull();
  });

  test("rejects garbage input without throwing", async () => {
    await expect(verify("not-a-jwt")).resolves.toBeNull();
  });

  test("rejects an unsigned/none-alg token (alg confusion attempt)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ email: "admin@example.co.il", aal: "aal2", sub: "x", exp: 9999999999 }),
    ).toString("base64url");
    const forged = `${header}.${payload}.`;
    await expect(verify(forged)).resolves.toBeNull();
  });

  test("returns null (does not throw) when JWKS is unreachable and no legacy secret is configured", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" });
    await expect(
      verifyAdminAccessToken(token, { supabaseUrl: UNREACHABLE_SUPABASE_URL }),
    ).resolves.toBeNull();
  });
});
