import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// ARCHITECTURE.md §6: strict security headers (self + Google Fonts +
// Supabase storage host), frame-ancestors 'none', HSTS,
// Referrer-Policy strict-origin-when-cross-origin — applied to every route
// (candidate, admin, api) from one place.
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
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

  // Admin auth (Supabase Auth session + mandatory TOTP aal2 + admin_users
  // allowlist check, ARCHITECTURE.md §6, ADMIN_UX.md §8) is NOT implemented
  // here — TODO(admin-ui engineer): verify the session JWT locally with
  // SUPABASE_JWT_SECRET, require aal2, check admin_users.disabled_at IS
  // NULL, and redirect unauthenticated/unenrolled requests to
  // /admin/login or /admin/mfa/enroll respectively.
  if (pathname.startsWith("/admin")) {
    return withSecurityHeaders(NextResponse.next());
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
