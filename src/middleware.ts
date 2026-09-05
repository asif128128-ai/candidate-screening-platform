import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  ADMIN_AUTH_COOKIE_NAME,
  extractAccessTokenFromCookieValue,
  verifyAdminAccessToken,
} from "./lib/admin-jwt";

const intlMiddleware = createIntlMiddleware(routing);

// Routes reachable without a stepped-up (aal2) admin session: the login
// form itself and the mandatory MFA enroll/verify page (ADMIN_UX.md §8 —
// "a user without an enrolled factor is routed to /admin/mfa/enroll and
// cannot reach any data page until done", which implies login+enroll must
// themselves be reachable without aal2).
const ADMIN_PUBLIC_PATHS = ["/admin/login", "/admin/mfa/enroll"];

// ARCHITECTURE.md §6: strict security headers (self + Google Fonts +
// Supabase storage host), frame-ancestors 'none', HSTS,
// Referrer-Policy strict-origin-when-cross-origin — applied to every route
// (candidate, admin, api) from one place.
//
// `nonce`: a plain `script-src 'self'` (no nonce) blocks every inline
// `<script>` Next.js itself generates to stream RSC payload/hydration data
// into the page — which means it blocks ALL client-side interactivity, not
// just literal inline `<script>` tags a page might author. This was caught
// while building the admin UI (every client component's onClick/form
// handler silently no-op'd; the browser console showed CSP violations) and
// is fixed here for `/admin/*` per the official Next.js nonce pattern
// (per-request nonce, threaded to the page render via a request header so
// Next's own generated scripts pick it up automatically, referenced in the
// response's CSP). It is intentionally scoped to admin routes only — the
// candidate side has no interactive client component yet (the assessment
// runner is still a TODO per IMPLEMENTATION_STATE.md) so is left on its
// original header here rather than touching shared candidate-flow behavior
// outside this admin-auth block; whoever builds the runner will need the
// same fix and should extend `nonce` to the candidate branch below.
function withSecurityHeaders(res: NextResponse, nonce?: string): NextResponse {
  // 'unsafe-eval' is added to script-src in non-production only: Next.js
  // dev mode's own client runtime (React Refresh / webpack HMR) evaluates
  // code strings, which a strict CSP otherwise blocks with no user-visible
  // error beyond a blank click-does-nothing page. Production builds don't
  // need it and don't get it.
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      nonce
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
            process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""
          }`
        : "script-src 'self'",
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
/** `NextResponse.next()` with the per-request nonce threaded through as a
 * request header, per Next.js's documented CSP-nonce pattern — this is
 * what lets Next's own generated inline scripts pick the nonce up and
 * satisfy the CSP this same request gets back in its response. */
function nextWithNonce(req: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function guardAdminRoute(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

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
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (claims.aal !== "aal2") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/mfa/enroll";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(nextWithNonce(req, nonce), nonce);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    return guardAdminRoute(req);
  }

  // API routes carry their own CSRF/Origin checks per route
  // (ARCHITECTURE.md §6); only security headers are added here.
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Candidate flow: next-intl locale routing (he only at launch).
  return withSecurityHeaders(intlMiddleware(req));
}

export const config = {
  matcher: [
    // Run on everything except static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
