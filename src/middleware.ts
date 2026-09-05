import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

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

// ARCHITECTURE.md §6: strict security headers (self + Google Fonts +
// Supabase storage host), frame-ancestors 'none', HSTS,
// Referrer-Policy strict-origin-when-cross-origin — applied to every route
// (candidate, admin, api) from one place.
function withSecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = generateNonce();

  // Admin auth (Supabase Auth session + mandatory TOTP aal2 + admin_users
  // allowlist check, ARCHITECTURE.md §6, ADMIN_UX.md §8) is NOT implemented
  // here — TODO(admin-ui engineer): verify the session JWT locally with
  // SUPABASE_JWT_SECRET, require aal2, check admin_users.disabled_at IS
  // NULL, and redirect unauthenticated/unenrolled requests to
  // /admin/login or /admin/mfa/enroll respectively.
  if (pathname.startsWith("/admin")) {
    return withSecurityHeaders(NextResponse.next(), nonce);
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
