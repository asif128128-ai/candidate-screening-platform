import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminAuthClient } from "../../../../lib/supabase-admin-auth-client";

// ADMIN_UX.md §8: a valid Supabase session whose email isn't an enabled
// `admin_users` row must be signed out, not just redirected — the message
// is "אין לך הרשאה למערכת זו". A Route Handler (not a Server Component)
// because only a Route Handler/Server Action can clear the session cookie.
// Reached only via a redirect from src/app/admin/(protected)/layout.tsx.
export async function GET(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseAdminAuthClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login?reason=denied", req.url), { status: 303 });
}
