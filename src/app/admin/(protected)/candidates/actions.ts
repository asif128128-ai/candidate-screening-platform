"use server";

import { revalidatePath } from "next/cache";
import type { TransactionSql } from "postgres";
import { withCurrentAdmin } from "../../../../lib/current-admin";
import { changeStage, setKeepIndefinitely, deleteCandidate } from "../../../../db/queries/candidate-mutations";
import { listCandidates, PAGE_SIZE } from "../../../../db/queries/candidates";
import { parseCandidateFilters } from "../../../../lib/candidate-filters";
import type { ApplicationStage } from "../../../../db/queries/types";

function isStage(v: unknown): v is ApplicationStage {
  return (
    typeof v === "string" &&
    ["applied", "assessment_started", "assessment_completed", "under_review", "interview", "rejected", "hired"].includes(v)
  );
}

/** Resolves "בחר את כל התוצאות של הסינון" (ADMIN_UX.md §3.5) into a concrete
 * id list, capped at 5,000, by re-running the same list query the page used
 * — shared with the CSV export route's identical loop. */
async function resolveApplicationIds(
  tx: TransactionSql,
  formData: FormData,
): Promise<string[]> {
  const explicit = String(formData.get("applicationIds") ?? "").split(",").filter(Boolean);
  if (explicit.length > 0) return explicit;

  const filtersQuery = String(formData.get("filtersQuery") ?? "");
  if (!filtersQuery) return [];
  const filters = parseCandidateFilters(new URLSearchParams(filtersQuery));
  const ids: string[] = [];
  let cursor: string | null = null;
  let offset = 0;
  for (let page = 0; page < Math.ceil(5000 / PAGE_SIZE); page++) {
    const result = await listCandidates(tx, { ...filters, cursor, offset });
    ids.push(...result.rows.map((r) => r.applicationId));
    if (!result.nextCursor && result.nextOffset === null) break;
    cursor = result.nextCursor;
    offset = result.nextOffset ?? offset;
  }
  return ids;
}

export async function changeStageAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const toStage = formData.get("toStage");
  const queueRejectionEmail = formData.get("queueRejectionEmail") === "on";
  if (!applicationId || !isStage(toStage)) return;

  await withCurrentAdmin((tx, admin) => changeStage(tx, applicationId, toStage, admin.id, { queueRejectionEmail }));
  revalidatePath("/admin/candidates");
  revalidatePath(`/admin/candidates/${applicationId}`);
}

/** ADMIN_UX.md §3.5 "בחר את כל התוצאות של הסינון, up to 5,000" bulk stage
 * change; run inside one admin transaction so a failure partway doesn't
 * leave a half-applied batch silently. */
export async function bulkChangeStageAction(formData: FormData): Promise<void> {
  const toStage = formData.get("toStage");
  const queueRejectionEmail = formData.get("queueRejectionEmail") === "on";
  if (!isStage(toStage)) return;

  await withCurrentAdmin(async (tx, admin) => {
    const ids = await resolveApplicationIds(tx, formData);
    for (const id of ids) {
      await changeStage(tx, id, toStage, admin.id, { queueRejectionEmail });
    }
  });
  revalidatePath("/admin/candidates");
}

export async function toggleKeepIndefiniteAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const value = formData.get("value") === "1";
  if (!applicationId) return;
  await withCurrentAdmin((tx) => setKeepIndefinitely(tx, applicationId, value));
  revalidatePath("/admin/candidates");
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export interface BulkArchiveResult {
  deleted: number;
  skipped: number;
  skippedReasons: string[];
}

/**
 * DECISIONS_LOG.md #19 "ארכב ומחק": excludes `hired`/`keep_indefinitely`
 * automatically, deletes the rest via `delete_candidate()` (cascades; CVs
 * go to the purge queue). The CSV export (the other half of this feature)
 * is a separate GET to /admin/candidates/export the client triggers before
 * calling this, so the download always reflects pre-delete data even if
 * this request is slow.
 *
 * Runs synchronously in batches of 100 within this one request rather than
 * as a resumable background job with a live progress bar — a deliberate
 * scope reduction for the stated candidate volumes (hundreds–low
 * thousands); see IMPLEMENTATION_NOTES.md. It is still safe to re-run: a
 * candidate already deleted simply won't match `applicationIds` clause
 * gathered from the current page's selection and is skipped harmlessly if
 * pointed at again.
 */
export async function bulkArchiveAndDeleteAction(formData: FormData): Promise<BulkArchiveResult> {
  return withCurrentAdmin(async (tx, admin) => {
    const applicationIds = await resolveApplicationIds(tx, formData);
    if (applicationIds.length === 0) return { deleted: 0, skipped: 0, skippedReasons: [] };
    const rows = await tx<{ application_id: string; candidate_id: string; stage: string; keep_indefinitely: boolean }[]>`
      select id as application_id, candidate_id, stage::text, keep_indefinitely
      from applications where id = any(${applicationIds}::uuid[])
    `;
    const eligible = rows.filter((r) => r.stage !== "hired" && !r.keep_indefinitely);
    const skipped = rows.length - eligible.length;

    const BATCH = 100;
    let deleted = 0;
    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH);
      for (const row of batch) {
        await deleteCandidate(tx, row.candidate_id, admin.id);
        deleted++;
      }
    }
    return {
      deleted,
      skipped,
      skippedReasons: skipped > 0 ? [`${skipped} מועמדים הוחרגו (התקבלו או מסומנים לשמירה לתמיד)`] : [],
    };
  });
}
