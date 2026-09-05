import "dotenv/config";
import { SignJWT } from "jose";
import type { BrowserContext } from "@playwright/test";

// Shared helper for admin e2e tests. Mints a Supabase-session-shaped cookie
// the same way src/lib/admin-jwt.ts expects to read it (see that file for
// the cookie format), signed with the *local* SUPABASE_JWT_SECRET — this
// lets tests exercise the real JWT-verification + aal2 + admin_users
// allowlist logic end-to-end against the local Postgres stand-in
// (IMPLEMENTATION_NOTES.md), without a live Supabase Auth service (not
// available in this environment). Real Supabase Auth login (password +
// TOTP challenge) itself is documented as untested for the same reason.
export const ADMIN_AUTH_COOKIE_NAME = "sb-admin-auth-token";

export async function mintAdminCookieValue(
  email: string,
  aal: "aal1" | "aal2" = "aal2",
): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET is not set (see .env)");

  const jwt = await new SignJWT({ email, aal, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-0000-0000-0000000000aa")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  const session = {
    access_token: jwt,
    refresh_token: "test-refresh-token",
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    token_type: "bearer",
    user: { id: "00000000-0000-0000-0000-0000000000aa", email },
  };
  return "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export async function addAdminCookie(
  context: BrowserContext,
  email: string,
  aal: "aal1" | "aal2" = "aal2",
): Promise<void> {
  const value = await mintAdminCookieValue(email, aal);
  await context.addCookies([
    { name: ADMIN_AUTH_COOKIE_NAME, value, domain: "127.0.0.1", path: "/" },
  ]);
}

// Seeded by scripts/dev-seed.sql — used across the admin e2e suite instead
// of each test re-discovering ids from the UI.
export const SEED_ADMIN_EMAIL = "admin@example.co.il";
export const SEED_SECOND_ADMIN_EMAIL = "reviewer@example.co.il";
export const SEED_YAEL_EMAIL = "yael.cohen@example.co.il";
