// DEPLOYMENT.md §8 step 3, ADMIN_UX.md §8: bootstrap/add an admin.
// `pnpm admin:add --email x@y --name "שם"` inserts an admin_users row and
// sends a Supabase Auth invite email (the invited admin sets a password and
// must enroll TOTP MFA before reaching any data page — enforced by
// middleware, not by this script).
//
// Uses MIGRATION_DATABASE_URL (project-owner) for the admin_users insert,
// because `app_user` alone cannot INSERT admin_users rows outside of an
// `admin`/`system` request context (DATA_MODEL.md §6.3) and this runs
// standalone, and SUPABASE_SERVICE_ROLE_KEY for the Auth invite API.
import "dotenv/config";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv: string[]): { email?: string; name?: string } {
  const out: { email?: string; name?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") out.email = argv[++i];
    if (argv[i] === "--name") out.name = argv[++i];
  }
  return out;
}

async function main() {
  const { email, name } = parseArgs(process.argv.slice(2));
  if (!email || !name) {
    console.error('Usage: pnpm admin:add --email "x@y.co.il" --name "שם מלא"');
    process.exit(1);
  }

  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!migrationUrl || !supabaseUrl || !serviceKey) {
    console.error(
      "MIGRATION_DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are all required.",
    );
    process.exit(1);
  }

  const sql = postgres(migrationUrl, { max: 1 });
  try {
    await sql`
      insert into admin_users (email, display_name)
      values (${email}, ${name})
      on conflict (email) do update set display_name = excluded.display_name, disabled_at = null
    `;
  } finally {
    await sql.end();
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) {
    console.error(`admin_users row created, but the Auth invite failed: ${error.message}`);
    console.error("You can resend the invite from the Supabase Auth dashboard.");
    process.exit(1);
  }

  console.log(`Admin "${name}" <${email}> added. Invite email sent — TOTP enrollment is required on first login.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
