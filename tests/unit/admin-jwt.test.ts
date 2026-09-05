import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import {
  extractAccessTokenFromCookieValue,
  verifyAdminAccessToken,
} from "@/lib/admin-jwt";

const SECRET = "test-secret-at-least-32-chars-long-ok";

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

// This is the security-critical logic behind src/middleware.ts's admin gate
// (ARCHITECTURE.md §6: "verify the session JWT locally with
// SUPABASE_JWT_SECRET, require aal2"). Pure and dependency-free enough to
// unit test exhaustively without a browser or a live Supabase project.

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

describe("verifyAdminAccessToken", () => {
  test("accepts a validly-signed aal2 token and returns its claims", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" });
    const claims = await verifyAdminAccessToken(token, SECRET);
    expect(claims).toMatchObject({ email: "admin@example.co.il", aal: "aal2" });
  });

  test("defaults aal to aal1 when the claim is missing (never trust-by-default to aal2)", async () => {
    const token = await sign({ email: "admin@example.co.il" });
    const claims = await verifyAdminAccessToken(token, SECRET);
    expect(claims?.aal).toBe("aal1");
  });

  test("rejects a token signed with the wrong secret", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" });
    const claims = await verifyAdminAccessToken(token, "a-completely-different-secret-value");
    expect(claims).toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await sign({ email: "admin@example.co.il", aal: "aal2" }, "-1s");
    const claims = await verifyAdminAccessToken(token, SECRET);
    expect(claims).toBeNull();
  });

  test("rejects a token with no email claim", async () => {
    const token = await sign({ aal: "aal2" });
    const claims = await verifyAdminAccessToken(token, SECRET);
    expect(claims).toBeNull();
  });

  test("rejects garbage input without throwing", async () => {
    await expect(verifyAdminAccessToken("not-a-jwt", SECRET)).resolves.toBeNull();
  });

  test("rejects an unsigned/none-alg token (alg confusion attempt)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ email: "admin@example.co.il", aal: "aal2", sub: "x", exp: 9999999999 }),
    ).toString("base64url");
    const forged = `${header}.${payload}.`;
    await expect(verifyAdminAccessToken(forged, SECRET)).resolves.toBeNull();
  });
});
