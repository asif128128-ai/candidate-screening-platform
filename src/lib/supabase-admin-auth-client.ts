import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadEnv } from "./env";
import { ADMIN_AUTH_COOKIE_NAME } from "./admin-jwt";

// ARCHITECTURE.md §1 "Admin auth" row / §6: a second Supabase client, using
// SUPABASE_ANON_KEY (not the service role), wired through @supabase/ssr,
// used ONLY for the admin Auth flow (sign in, MFA enroll/verify, sign out).
// Never used for data access — all data queries go through
// src/db/postgres.ts's withAdmin()/withSystem() against `app_user`
// (DATA_MODEL.md §6). This is the module the old `src/db/supabase.ts` TODO
// pointed at.
//
// Server Actions and Server Components can both read cookies via
// `next/headers`; only Server Actions (and Route Handlers) can *write*
// them, which is fine here because every auth mutation (sign in, MFA
// verify, sign out) happens inside a Server Action.
export async function createSupabaseAdminAuthClient() {
  const env = loadEnv();
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookieOptions: { name: ADMIN_AUTH_COOKIE_NAME, path: "/admin", sameSite: "lax" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not an Action/Route
          // Handler) — cookies can't be written there. Harmless: the
          // middleware + the next Action will reconcile it.
        }
      },
    },
  });
}
