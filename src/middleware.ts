import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  ADMIN_AUTH_COOKIE_NAME,
  extractAccessTokenFromCookieValue,
  verifyAdminAccessToken,
} from "./lib/admin-jwt";

const intlMiddleware = createIntlMiddleware(routing);

// candidate-flow engineer's fix (see IMPLEMENTATION_NOTES.md "CSP blocked
// Next.js's own hydration scripts in production"): the original
// `script-src 'self'` (no nonce/unsafe-inline) silently broke every page —
// Next.js's App Router injects its RSC-streaming bootstrap as inline
// <script> tags, which that CSP blocks outright. The browser still gets a
// 200 with the full SSR HTML (invisible to a plain `curl` check, which is
// presumably why this shipped unnoticed), but hydration never runs, so the
// page renders blank/dead in every real browser once `next start` serves a
// production build. Fixed the standard documented way (Next.js's own CSP
// guide): a fresh per-request nonce in `script-src`, which Next
// automatically applies to its own inline scripts once it sees a nonce in
// the response's Content-Security-Policy header.
function generateNonce(): string {
  // 16 random bytes, base64 — Web Crypto (available in the Edge middleware
  // runtime), not node:crypto.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Routes reachable without a stepped-up (aal2) admin session: the login
// form itself and the mandatory MFA enroll/verify page (ADMIN_UX.md §8 —
// "a user without an enrolled factor is routed to /admin/mfa/enroll and
// cannot reach any data page until done", which implies login+enroll must
// themselves be reachable without aal2).
const ADMIN_PUBLIC_PATHS = ["/admin/login", "/admin/mfa/enroll"];

// ARCHITECTURE.md §6: strict security headers (self + Google Fonts +
// Supabase storage host), frame-ancestors 'none', HSTS,
// Referrer-Policy strict-origin-when-cross-origin — applied to every route
// (candidate, admin, api) from one place. Every caller now generates and
// supplies its own per-request nonce (see `generateNonce`/`guardAdminRoute`)
// so this always renders a nonce-based `script-src`, never the plain
// `'self'` that broke hydration everywhere.
function withSecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // 'unsafe-eval' is added in non-production only: Next.js dev mode's
      // own client runtime (React Refresh / webpack HMR) evaluates code
      // strings, which a strict CSP otherwise blocks with no user-visible
      // error beyond a blank click-does-nothing page. Production builds
      // don't need it and don't get it.
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
        process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""
      }`,
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains",
  );
  return res;
}

/** `NextResponse.next()` with the per-request nonce threaded through as a
 * request header, per Next.js's documented CSP-nonce pattern — this is
 * what lets Next's own generated inline scripts pick the nonce up and
 * satisfy the CSP this same request gets back in its response. Used on
 * admin routes, whose Server Components need to read the nonce explicitly
 * (see src/app/admin/(protected)/layout.tsx). */
function nextWithNonce(req: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Admin auth, first layer (ARCHITECTURE.md §6, ADMIN_UX.md §8): verify the
// Supabase session JWT *locally* (no network round-trip — see
// src/lib/admin-jwt.ts for why) and require `aal2` (TOTP completed). This
// is deliberately the *only* thing checked here: middleware (Edge runtime)
// cannot open a raw Postgres connection, so it cannot itself verify the
// `admin_users` allowlist / `disabled_at` — that second, DB-backed check
// happens in src/app/admin/(protected)/layout.tsx (a Server Component,
// Node.js runtime) via src/lib/current-admin.ts, which every protected
// admin page renders through. A request that clears this JWT check but
// fails the allowlist check is signed out and bounced to /admin/login by
// that layout — so both layers are enforced before any data page renders,
// exactly as ADMIN_UX.md §8 requires, just split across two runtimes.
async function guardAdminRoute(req: NextRequest, nonce: string): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return withSecurityHeaders(nextWithNonce(req, nonce), nonce);
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const raw = req.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const token = jwtSecret ? extractAccessTokenFromCookieValue(raw) : null;
  const claims = token && jwtSecret ? await verifyAdminAccessToken(token, jwtSecret) : null;

  if (!claims || claims.exp * 1000 < Date.now()) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), nonce);
  }

  if (claims.aal !== "aal2") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/mfa/enroll";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), nonce);
  }

  return withSecurityHeaders(nextWithNonce(req, nonce), nonce);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = generateNonce();

  if (pathname.startsWith("/admin")) {
    return guardAdminRoute(req, nonce);
  }

  // API routes carry their own CSRF/Origin checks per route
  // (ARCHITECTURE.md §6); only security headers are added here.
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.next(), nonce);
  }

  // Candidate flow: next-intl locale routing (he only at launch).
  return withSecurityHeaders(intlMiddleware(req), nonce);
}

export const config = {
  matcher: [
    // Run on everything except static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
