// DEPLOYMENT.md §8 step 2: after `pnpm migrate` creates the `app_user` role
// (with a placeholder password baked into the migration, see
// supabase/migrations/0001_init.sql §1), this script sets a real random
// password using the project-owner credential and prints the pooler
// DATABASE_URL to paste into Render.
//
// Usage: MIGRATION_DATABASE_URL=... pnpm db:set-app-password
import "dotenv/config";
import postgres from "postgres";
import { randomBytes } from "node:crypto";

async function main() {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl) {
    console.error("MIGRATION_DATABASE_URL is required (project-owner direct connection).");
    process.exit(1);
  }

  const password = randomBytes(24).toString("base64url");
  const sql = postgres(migrationUrl, { max: 1 });
  try {
    // Role name is fixed and not user input; password is parameterized.
    await sql.unsafe(`alter role app_user with password '${password.replace(/'/g, "''")}'`);
  } finally {
    await sql.end();
  }

  console.log("app_user password set.");
  console.log(
    "Copy the Supabase 'Transaction pooler' connection string (Project Settings -> " +
      "Database -> Connection string), replace its user/password with:",
  );
  console.log(`  user: app_user`);
  console.log(`  password: ${password}`);
  console.log(
    "...and set the result as DATABASE_URL in Render (port 6543, sslmode=require).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
