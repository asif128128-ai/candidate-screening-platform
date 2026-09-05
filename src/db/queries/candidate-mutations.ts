import type { TransactionSql } from "postgres";
import type { ApplicationStage, IntegrityRisk } from "./types";

// Admin write paths for a single application/candidate (ADMIN_UX.md §4,
// §3.5). Every mutation here assumes it is called inside a `withAdmin(...)`
// transaction (DATA_MODEL.md §6.2) — RLS then does the actual enforcement
// that the caller is an enabled admin; these functions don't re-check that.

export async function changeStage(
  tx: TransactionSql,
  applicationId: string,
  toStage: ApplicationStage,
  adminId: string,
  opts: { note?: string; queueRejectionEmail?: boolean } = {},
): Promise<void> {
  const [current] = await tx<{ stage: ApplicationStage; job_id: string; email: string }[]>`
    select a.stage, a.job_id, c.email
    from applications a join candidates c on c.id = a.candidate_id
    where a.id = ${applicationId}
  `;
  if (!current) throw new Error("בקשה לא נמצאה");

  await tx`
    update applications set stage = ${toStage}, stage_changed_at = now()
    where id = ${applicationId}
  `;
  await tx`
    insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
    values (${applicationId}, ${current.stage}, ${toStage}, ${adminId}, ${opts.note ?? null})
  `;

  // DECISIONS_LOG.md #3: moving to נדחה queues a short, non-personalized
  // closure email (job-level default + per-change checkbox).
  if (toStage === "rejected" && opts.queueRejectionEmail) {
    await tx`
      insert into email_outbox (to_email, template, payload, application_id)
      values (${current.email}, 'not_moving_forward', ${tx.json({ application_id: applicationId })}, ${applicationId})
    `;
  }
}

export async function addNote(
  tx: TransactionSql,
  applicationId: string,
  authorId: string,
  body: string,
  kind: string = "note",
): Promise<void> {
  await tx`
    insert into admin_notes (application_id, author_id, kind, body)
    values (${applicationId}, ${authorId}, ${kind}, ${body})
  `;
}

export async function setKeepIndefinitely(
  tx: TransactionSql,
  applicationId: string,
  value: boolean,
): Promise<void> {
  await tx`update applications set keep_indefinitely = ${value} where id = ${applicationId}`;
}

export async function markIntegrityReviewed(
  tx: TransactionSql,
  applicationId: string,
  adminId: string,
): Promise<void> {
  await addNote(tx, applicationId, adminId, "סומן כנבדק — רמת האמינות נסקרה ידנית.", "integrity_reviewed");
}

/**
 * Admin override: "ignore focus signals" (ADMIN_UX.md §4.2 tab 3,
 * ANTI_CHEATING.md §8). `assessment_results` is otherwise immutable
 * (`results_immutable` trigger, DATA_MODEL.md §5) — only the five
 * `integrity_*adjust*`/`integrity_ignore_focus` columns may change, which is
 * exactly what this writes.
 *
 * The actual re-scoring logic (which reasons a "focus" ignore should drop,
 * and the resulting risk level) belongs in the assessment-engine's
 * `computeIntegrity()` (src/assessment/integrity.ts, ANTI_CHEATING.md §5) —
 * that function is still a stub (`throw new Error(...)`) as of this build.
 * Rather than block this admin feature on that engineer's work, this uses a
 * narrow, clearly-provisional recompute limited to what an override can
 * safely do (drop focus/tab/blur-coded reasons and re-derive a risk band
 * from the remaining weight) — see IMPLEMENTATION_NOTES.md. Replace this
 * with a call into the real `computeIntegrity()`'s "ignore focus" mode once
 * it exists.
 */
export async function ignoreFocusSignals(
  tx: TransactionSql,
  applicationId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  const [row] = await tx<
    { session_id: string; integrity_reasons: Array<{ code: string; weight: number }> }[]
  >`
    select r.session_id, r.integrity_reasons
    from assessment_results r where r.application_id = ${applicationId}
  `;
  if (!row) throw new Error("לא נמצאו תוצאות מבחן");

  const focusCodes = ["tab_hidden", "tab_hidden_short", "tab_hidden_multi", "blur_only", "instance_new"];
  const remainingWeight = (row.integrity_reasons ?? [])
    .filter((r) => !focusCodes.some((c) => r.code.startsWith(c)))
    .reduce((sum, r) => sum + (r.weight ?? 0), 0);

  const adjustedRisk: IntegrityRisk = remainingWeight >= 60 ? "high" : remainingWeight >= 30 ? "medium" : "low";

  await tx`
    update assessment_results
    set integrity_ignore_focus = true,
        integrity_risk_adjusted = ${adjustedRisk},
        integrity_adjusted_by = ${adminId},
        integrity_adjust_reason = ${reason},
        integrity_adjusted_at = now()
    where application_id = ${applicationId}
  `;
}

export async function undoIgnoreFocusSignals(tx: TransactionSql, applicationId: string): Promise<void> {
  await tx`
    update assessment_results
    set integrity_ignore_focus = false, integrity_risk_adjusted = null,
        integrity_adjusted_by = null, integrity_adjust_reason = null, integrity_adjusted_at = null
    where application_id = ${applicationId}
  `;
}

/** Danger zone "אפס מבחן": deletes the session (cascades items/responses/
 * events/results) and returns the candidate to `applied` so they can be
 * re-invited. */
export async function resetAssessment(
  tx: TransactionSql,
  applicationId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  const [current] = await tx<{ stage: ApplicationStage }[]>`select stage from applications where id = ${applicationId}`;
  if (!current) throw new Error("בקשה לא נמצאה");

  await tx`delete from assessment_sessions where application_id = ${applicationId}`;
  await tx`update applications set stage = 'applied', stage_changed_at = now() where id = ${applicationId}`;
  await tx`
    insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
    values (${applicationId}, ${current.stage}, 'applied', ${adminId}, ${"איפוס מבחן: " + reason})
  `;
  await addNote(tx, applicationId, adminId, "המבחן אופס: " + reason, "assessment_reset");
}

/** Danger zone "מחק מועמד": deletes the whole candidate (all applications)
 * via the SECURITY DEFINER function (DATA_MODEL.md §6.1 — app_user has no
 * direct DELETE on candidates), then records the one non-PII audit trace. */
export async function deleteCandidate(
  tx: TransactionSql,
  candidateId: string,
  adminId: string,
): Promise<void> {
  await tx`select delete_candidate(${candidateId}::uuid)`;
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id)
    values (${adminId}, 'candidate.delete', 'candidate', ${candidateId})
  `;
}
