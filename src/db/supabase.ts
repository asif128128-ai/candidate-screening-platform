import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../lib/env";

// ARCHITECTURE.md §1, §2, §6: the service-role key is confined to two
// server-side calls — Storage signed URLs (CV downloads) and the Auth admin
// API (inviting admins). It is NEVER used for data access via PostgREST;
// all data access goes through src/db/postgres.ts (withCandidate/withAdmin/
// withSystem) against the least-privilege `app_user` role instead.
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseServiceClient() {
  if (client) return client;
  const env = loadEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

// The second client using SUPABASE_ANON_KEY, wired through @supabase/ssr for
// the admin login (Auth) flow only — never for data (ARCHITECTURE.md §1
// "Admin auth" row) — lives in src/lib/supabase-admin-auth-client.ts
// (it needs the Next.js `cookies()` API, which isn't available here).
