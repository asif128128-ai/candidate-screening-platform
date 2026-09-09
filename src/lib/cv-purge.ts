import { withSystem } from "@/db/postgres";
import { getSupabaseServiceClient } from "@/db/supabase";

// DATA_MODEL.md §3.9 / §8: `cv_purge_queue` is filled by the
// `cv_files_purge` trigger (`cv_enqueue_purge()`, 0001_init.sql) every time
// a `cv_files` row is deleted or repointed — that is the record saying "this
// object must leave Storage". This module is the consumer that acts on it.
//
// It did not exist until 2026-09-09, and its absence was a live outage plus
// a retention violation:
//
//   * Nothing ever deleted from the bucket, so every CV a candidate or admin
//     "deleted" was still sitting in Storage, contrary to the retention
//     policy. Every reference to the table anywhere in the codebase was a
//     `select count(*)`.
//   * `/api/health` returned 503 for any row older than 24 h. Since nothing
//     drained the queue, the FIRST CV ever deleted took the whole service
//     down permanently, exactly 24 h later. That is what happened: a row
//     enqueued 2026-09-07 21:58:55Z put the service into a Render restart
//     loop from 2026-09-08 21:58:55Z until it was fixed.
//
// A backlog no longer returns 503 (see src/app/api/health/route.ts) — but
// that only downgrades the symptom. This is the actual fix.
//
// Runs entirely on privileges `app_user` already holds: SELECT and DELETE on
// cv_purge_queue (0001_init.sql:968-969), and the `admin_only` policy admits
// `app_ctx() = 'system'` for all commands. It deliberately needs no
// migration, so it could be deployed to recover the service without a
// schema change first. The one privilege it lacks — UPDATE, for the
// attempts/last_error bookkeeping — is optional and handled below.

const BATCH_SIZE = 50;

export interface PurgeResult {
  removed: number;
  failed: number;
}

/**
 * Deletes objects from Storage. Injectable so the drain logic can be tested
 * without a live Storage backend.
 */
export type ObjectRemover = (bucket: string, paths: string[]) => Promise<{ error: string | null }>;

const defaultRemover: ObjectRemover = async (bucket, paths) => {
  // Service-role Storage call — ARCHITECTURE.md §1 confines the service role
  // to Storage operations and Auth admin, which this is.
  const client = getSupabaseServiceClient();
  const { error } = await client.storage.from(bucket).remove(paths);
  return { error: error ? error.message : null };
};

/**
 * Drains up to BATCH_SIZE queued objects, oldest first.
 *
 * A row is removed once the object is gone from Storage. Supabase's
 * `remove()` does NOT error on an object that no longer exists (it reports
 * an empty deleted-objects list), which is the behavior we want: an object
 * already deleted by hand, or double-enqueued, must not pin the row in the
 * queue forever. Anything that genuinely fails keeps its row and records
 * `attempts`/`last_error` so a persistent failure is visible in the admin
 * Settings page instead of silently retrying nowhere.
 *
 * Never throws — it runs from the maintenance scheduler, which must survive
 * a Storage outage.
 */
export async function drainCvPurgeQueue(
  remove: ObjectRemover = defaultRemover,
): Promise<PurgeResult> {
  const rows = await withSystem((tx) =>
    tx<{ object_path: string; bucket: string }[]>`
      select object_path, bucket from cv_purge_queue
      order by enqueued_at
      limit ${BATCH_SIZE}
    `,
  );

  let removed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { error } = await remove(row.bucket, [row.object_path]);
      if (error) throw new Error(error);

      await withSystem(
        (tx) => tx`delete from cv_purge_queue where object_path = ${row.object_path}`,
      );
      removed += 1;
    } catch (err) {
      failed += 1;
      const message = String(err).slice(0, 500);
      console.error(
        JSON.stringify({ event: "cv_purge_failed", bucket: row.bucket, error: message }),
      );

      // Best-effort bookkeeping, deliberately not fatal. `app_user` holds
      // SELECT and DELETE on this table (0001_init.sql:968-969) but no
      // UPDATE, so this write fails with "permission denied for table
      // cv_purge_queue" until the grant in `staged/purge-grants` ships.
      // The important invariant — a failed object KEEPS its row, so the
      // work is never lost and the backlog alarm still fires — holds
      // either way, because it comes from not reaching the DELETE above.
      // Losing the attempt counter degrades observability, not correctness,
      // and must never turn a Storage failure into an unhandled rejection
      // inside the maintenance scheduler.
      try {
        await withSystem(
          (tx) => tx`
            update cv_purge_queue
            set attempts = attempts + 1, last_error = ${message}
            where object_path = ${row.object_path}
          `,
        );
      } catch (bookkeepingErr) {
        console.error(
          JSON.stringify({
            event: "cv_purge_bookkeeping_failed",
            error: String(bookkeepingErr).slice(0, 200),
          }),
        );
      }
    }
  }

  if (removed > 0 || failed > 0) {
    console.log(JSON.stringify({ event: "cv_purge_drained", removed, failed }));
  }

  return { removed, failed };
}
