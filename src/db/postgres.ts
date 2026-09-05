import postgres from "postgres";
import { loadEnv } from "../lib/env";

// DATA_MODEL.md §6.2 / ARCHITECTURE.md §5.3, §10: the app connects as the
// least-privilege `app_user` role through Supabase's Supavisor pooler
// (transaction mode). Pool sized for a synchronized-start burst, not
// steady state (ARCHITECTURE.md §7).
let sql: postgres.Sql | null = null;

function getSql(): postgres.Sql {
  if (sql) return sql;
  const env = loadEnv();
  sql = postgres(env.DATABASE_URL, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 5,
    // DEPLOYMENT.md §10: statement_timeout set on the pooler connection.
    connection: { statement_timeout: 10_000 },
  });
  return sql;
}

export type AppContext = "candidate" | "admin" | "system";

/**
 * Every transaction must go through one of withCandidate / withAdmin /
 * withSystem below — there is deliberately no "raw" query export
 * (DATA_MODEL.md §6.2). Each sets `app.context` (+ the relevant id) via
 * `SET LOCAL` so RLS policies (DATA_MODEL.md §6.3) can scope the
 * transaction, which is what makes a missed `WHERE` in application code
 * harmless.
 */
async function withContext<T>(
  ctx: AppContext,
  ids: { applicationId?: string; adminId?: string },
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const client = getSql();
  // Cast: postgres.js's `begin<T>` return type (`UnwrapPromiseArray<T>`) is
  // meant for its own tagged-template result arrays and doesn't line up
  // with an arbitrary generic T here; the runtime behavior (resolve to
  // whatever the callback returns) is exactly what we want.
  return client.begin(async (tx) => {
    await tx`select set_config('app.context', ${ctx}, true)`;
    if (ids.applicationId) {
      await tx`select set_config('app.application_id', ${ids.applicationId}, true)`;
    }
    if (ids.adminId) {
      await tx`select set_config('app.admin_id', ${ids.adminId}, true)`;
    }
    return fn(tx);
  }) as Promise<T>;
}

/** Candidate-scoped transaction, restricted by RLS to `applicationId`'s own rows. */
export function withCandidate<T>(
  applicationId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return withContext("candidate", { applicationId }, fn);
}

/** Admin-scoped transaction; RLS requires `adminId` to be an enabled admin_users row. */
export function withAdmin<T>(
  adminId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return withContext("admin", { adminId }, fn);
}

/**
 * System-scoped transaction: boot-time checks and the hourly maintenance
 * sweep only (ARCHITECTURE.md §8). Never used on a candidate/admin request.
 */
export function withSystem<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return withContext("system", {}, fn);
}

/** For process shutdown (DEPLOYMENT.md §10 graceful SIGTERM drain). */
export async function closePool(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 10 });
    sql = null;
  }
}
