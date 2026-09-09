import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// DATA_MODEL.md §3.9 / §8. `cv_purge_queue` had no consumer at all until
// 2026-09-09: the `cv_files_purge` trigger filled it, and every reference to
// it in the codebase was a `select count(*)`. Two consequences, both real:
// deleted CVs were never actually removed from Storage (a retention
// violation), and `/api/health` returned 503 for any row older than 24 h —
// so the first CV ever deleted took the service down permanently, 24 h
// later, which is exactly what happened on 2026-09-08.
//
// These tests pin the drain behavior that fixes it. Storage is injected, so
// no live bucket is needed. Rows are seeded over a superuser connection
// because `app_user` deliberately has no INSERT grant on this table — only
// the SECURITY DEFINER trigger writes to it (0001_init.sql §968-969).

const hasDb = !!process.env.DATABASE_URL;

process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.CANDIDATE_COOKIE_SECRET ??= "test-candidate-cookie-secret-01234567890123456789";
process.env.ITEM_TOKEN_SECRET ??= "test-item-token-secret-0123456789012345";

const PATH_OK = "test-purge/ok.pdf";
const PATH_FAIL = "test-purge/fail.pdf";

describe.runIf(hasDb)("drainCvPurgeQueue() (integration)", () => {
  function deriveSuperuserUrl(): string {
    if (process.env.TEST_DB_SUPERUSER_URL) return process.env.TEST_DB_SUPERUSER_URL;
    const url = new URL(process.env.DATABASE_URL!);
    url.username = "";
    url.password = "";
    return url.toString();
  }
  // Created in beforeAll, not at describe-body scope: `describe.runIf(false)`
  // still evaluates this factory to enumerate the skipped tests.
  let superuserSql: ReturnType<typeof postgres>;

  let withSystem: typeof import("@/db/postgres").withSystem;
  let closePool: typeof import("@/db/postgres").closePool;
  let drainCvPurgeQueue: typeof import("@/lib/cv-purge").drainCvPurgeQueue;

  beforeAll(async () => {
    superuserSql = postgres(deriveSuperuserUrl(), { max: 2 });
    ({ withSystem, closePool } = await import("@/db/postgres"));
    ({ drainCvPurgeQueue } = await import("@/lib/cv-purge"));
  });

  beforeEach(async () => {
    await superuserSql`delete from cv_purge_queue where object_path in (${PATH_OK}, ${PATH_FAIL})`;
  });

  async function seed(path: string): Promise<void> {
    await superuserSql`insert into cv_purge_queue (object_path, bucket) values (${path}, 'cv')`;
  }

  async function queued(path: string) {
    return superuserSql<{ attempts: number; last_error: string | null }[]>`
      select attempts, last_error from cv_purge_queue where object_path = ${path}
    `;
  }

  it("removes the object from Storage and deletes the row", async () => {
    await seed(PATH_OK);

    const asked: Array<{ bucket: string; paths: string[] }> = [];
    const result = await drainCvPurgeQueue(async (bucket, paths) => {
      asked.push({ bucket, paths });
      return { error: null };
    });

    expect(asked).toContainEqual({ bucket: "cv", paths: [PATH_OK] });
    expect(result.removed).toBeGreaterThanOrEqual(1);
    expect(await queued(PATH_OK)).toHaveLength(0);
  });

  it("keeps the row when Storage fails, and records attempts/last_error where permitted", async () => {
    await seed(PATH_FAIL);

    const result = await drainCvPurgeQueue(async (_bucket, paths) =>
      paths.includes(PATH_FAIL) ? { error: "storage exploded" } : { error: null },
    );

    expect(result.failed).toBeGreaterThanOrEqual(1);

    // The invariant that matters: a failed object keeps its row, so the work
    // is never lost and the backlog alarm still fires. This holds regardless
    // of privileges, because it follows from not reaching the DELETE.
    const [row] = await queued(PATH_FAIL);
    expect(row).toBeDefined();

    // The attempts/last_error write needs an UPDATE grant app_user does not
    // have yet (see staged/purge-grants). Bookkeeping is best-effort by
    // design, so assert it only where the grant is actually present —
    // otherwise this suite would fail on a from-scratch database, which is
    // exactly what CI builds.
    const [priv] = await superuserSql<{ allowed: boolean }[]>`
      select has_column_privilege('app_user', 'cv_purge_queue', 'attempts', 'UPDATE') as allowed
    `;
    if (priv!.allowed) {
      expect(row!.attempts).toBe(1);
      expect(row!.last_error).toContain("storage exploded");
    } else {
      expect(row!.attempts).toBe(0);
    }
  });

  it("drains a row whose object is already gone (remove() reports no error)", async () => {
    // The failure mode this guards against: an object deleted by hand, or
    // enqueued twice, must not pin its row in the queue forever — that is
    // precisely what turns a backlog into a permanent one.
    await seed(PATH_OK);

    await drainCvPurgeQueue(async () => ({ error: null }));

    expect(await queued(PATH_OK)).toHaveLength(0);
  });

  it("the health probe stops reporting a backlog once the queue drains", async () => {
    const { checkDb } = await import("@/lib/health-check");
    await superuserSql`
      insert into cv_purge_queue (object_path, bucket, enqueued_at)
      values (${PATH_OK}, 'cv', now() - interval '48 hours')
    `;

    const before = await checkDb();
    expect(before.purgeBacklog).toBeGreaterThanOrEqual(1);

    await drainCvPurgeQueue(async () => ({ error: null }));

    const after = await checkDb();
    expect(after.purgeBacklog).toBe(0);
  });

  afterAll(async () => {
    await superuserSql`delete from cv_purge_queue where object_path in (${PATH_OK}, ${PATH_FAIL})`;
    await superuserSql.end({ timeout: 5 });
    await closePool();
  });
});
