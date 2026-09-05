import { cache } from "react";
import { cookies } from "next/headers";
import type { TransactionSql } from "postgres";
import { loadEnv } from "./env";
import { withSystem, withAdmin } from "../db/postgres";
import {
  ADMIN_AUTH_COOKIE_NAME,
  extractAccessTokenFromCookieValue,
  verifyAdminAccessToken,
} from "./admin-jwt";

export interface CurrentAdmin {
  id: string;
  email: string;
  displayName: string;
}

export type AdminSessionResolution =
  | { status: "ok"; admin: CurrentAdmin }
  | { status: "no_session" }
  | { status: "not_allowlisted"; email: string };

/**
 * Full detail version of getCurrentAdmin() below: distinguishes "no/invalid
 * session" from "valid aal2 Supabase session, but not an enabled
 * `admin_users` row" — the layout needs that distinction to actually sign
 * the second case out (ADMIN_UX.md §8: "failure → 'אין לך הרשאה למערכת
 * זו' and sign-out"), which it cannot do itself (Server Components can't
 * write cookies) — see src/app/admin/login/deny/route.ts.
 */
export const resolveAdminSession = cache(async (): Promise<AdminSessionResolution> => {
  const env = loadEnv();
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const token = extractAccessTokenFromCookieValue(raw);
  if (!token) return { status: "no_session" };

  const claims = await verifyAdminAccessToken(token, {
    supabaseUrl: env.SUPABASE_URL,
    legacyJwtSecret: env.SUPABASE_JWT_SECRET,
  });
  if (!claims || claims.aal !== "aal2" || claims.exp * 1000 < Date.now()) {
    return { status: "no_session" };
  }

  const rows = await withSystem((tx) =>
    tx<{ id: string; display_name: string }[]>`
      select id, display_name from admin_users
      where email = ${claims.email} and disabled_at is null
      limit 1
    `,
  );
  const row = rows[0];
  if (!row) return { status: "not_allowlisted", email: claims.email };
  return { status: "ok", admin: { id: row.id, email: claims.email, displayName: row.display_name } };
});

/**
 * Resolves the calling admin from the session cookie: (1) locally verify
 * the Supabase JWT (signature + aal2 + expiry — see admin-jwt.ts), then
 * (2) look up the `admin_users` allowlist row by the verified email
 * (ADMIN_UX.md §8: "middleware checks admin_users.email = jwt.email AND
 * disabled_at IS NULL").
 *
 * Step (2) necessarily runs in `system` DB context, not `admin`: the RLS
 * policy on `admin_users` (DATA_MODEL.md §6.3) only allows reads when
 * `app.admin_id` already names an *enabled* admin — which is exactly the
 * fact this lookup exists to establish. Using `system` here is narrow and
 * safe: it is a single SELECT by an email that already passed Supabase's
 * own signed-JWT verification, not arbitrary admin-context access, and it
 * is the only path that can resolve a fresh login into an `admin_id` at
 * all (documented as a deliberate, narrow exception to "system context is
 * boot/sweep only" — see IMPLEMENTATION_NOTES.md).
 *
 * `cache()` (React's per-request memoization) means every Server
 * Component/Action in one request pays for this at most once.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const resolution = await resolveAdminSession();
  return resolution.status === "ok" ? resolution.admin : null;
});

/** Throws-away helper for Server Actions: resolves the admin or throws. */
export async function requireCurrentAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error("לא מחובר/ת כמנהל/ת מערכת — יש להתחבר מחדש.");
  }
  return admin;
}

/** Convenience wrapper: runs `fn` in an admin-scoped DB transaction for the current admin. */
export async function withCurrentAdmin<T>(
  fn: (tx: TransactionSql, admin: CurrentAdmin) => Promise<T>,
): Promise<T> {
  const admin = await requireCurrentAdmin();
  return withAdmin(admin.id, (tx) => fn(tx, admin));
}
