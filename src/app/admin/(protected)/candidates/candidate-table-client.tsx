"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { AdminApplicationRow } from "../../../../db/queries/types";
import type { CandidateFilters } from "../../../../lib/candidate-filters";
import { serializeCandidateFilters } from "../../../../lib/candidate-filters";
import {
  STAGE_LABELS_HE,
  STAGE_ORDER,
  INTEGRITY_LABELS_HE,
  formatScore,
  formatDate,
  formatRelativeTime,
  isOverdueForReply,
  scoreBand,
} from "../../../../lib/admin-format";
import { ScoreBandPill, IntegrityPill, StagePill, Badge } from "../../../../components/admin/pill";
import { ScoreBar } from "../../../../components/admin/score-bar";
import { changeStageAction, bulkChangeStageAction, bulkArchiveAndDeleteAction } from "./actions";

// ADMIN_UX.md §3.4/§3.5: the dense candidate table + row-level stage
// dropdown + bulk-action toolbar. A client component because selection
// state (checkboxes) and the typed-confirmation delete dialog need it;
// every actual mutation still goes through a Server Action.

export function CandidateTableClient({
  rows,
  filters,
}: {
  rows: AdminApplicationRow[];
  filters: CandidateFilters;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [confirmText, setConfirmText] = useState("");

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.applicationId));
  const selectedCount = selectAllFiltered ? null : selected.size;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected(allOnPageSelected ? new Set() : new Set(rows.map((r) => r.applicationId)));
    setSelectAllFiltered(false);
  }

  const filtersQuery = useMemo(() => serializeCandidateFilters(filters), [filters]);
  const selectedIds = Array.from(selected).join(",");

  function exportCsv() {
    const url = selectAllFiltered
      ? `/admin/candidates/export?${filtersQuery}`
      : `/admin/candidates/export?ids=${selectedIds}`;
    window.open(url, "_blank");
  }

  function submitBulkStage(formData: FormData) {
    if (selectAllFiltered) {
      formData.set("applicationIds", "");
      formData.set("filtersQuery", filtersQuery);
    } else {
      formData.set("applicationIds", selectedIds);
    }
    startTransition(async () => {
      await bulkChangeStageAction(formData);
      setSelected(new Set());
      setSelectAllFiltered(false);
    });
  }

  function confirmArchiveDelete() {
    if (!selectAllFiltered && confirmText !== String(selected.size)) return;
    startTransition(async () => {
      // Export first, so the download always reflects pre-delete data.
      exportCsv();
      const fd = new FormData();
      if (selectAllFiltered) fd.set("filtersQuery", filtersQuery);
      else fd.set("applicationIds", selectedIds);
      const result = await bulkArchiveAndDeleteAction(fd);
      const parts = [`נמחקו ${result.deleted} מועמדים.`, ...result.skippedReasons];
      if (result.failed > 0) {
        parts.push(`${result.failed} מועמדים נכשלו במחיקה: ${result.failedReasons.join("; ")}`);
      }
      setArchiveResult(parts.join(" "));
      setSelected(new Set());
      setSelectAllFiltered(false);
      confirmDialogRef.current?.close();
      setConfirmText("");
    });
  }

  return (
    <div>
      {(selected.size > 0 || selectAllFiltered) && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-medium">
            {selectAllFiltered ? "כל התוצאות של הסינון (עד 5,000)" : `נבחרו ${selectedCount}`}
          </span>
          <form action={submitBulkStage} className="flex items-center gap-1">
            <select name="toStage" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS_HE[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-600">
              <input type="checkbox" name="queueRejectionEmail" defaultChecked />
              שלח הודעת סיום אם נדחה
            </label>
            <button type="submit" disabled={isPending} className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white">
              שנה שלב ל…
            </button>
          </form>
          <button onClick={exportCsv} className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-white">
            ייצוא CSV
          </button>
          <button
            onClick={() => confirmDialogRef.current?.showModal()}
            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            ארכב ומחק
          </button>
        </div>
      )}

      {archiveResult && <p className="mb-2 text-sm text-neutral-600">{archiveResult}</p>}

      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="w-8 px-2 py-2">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
              </th>
              <th className="px-2 py-2 text-start">שם</th>
              <th className="px-2 py-2 text-start">ציון כולל</th>
              <th className="px-2 py-2 text-start">חשיבה / עצמאות / טכנולוגי / מהירות</th>
              <th className="px-2 py-2 text-start">אמינות</th>
              <th className="px-2 py-2 text-start">אחוזון</th>
              <th className="px-2 py-2 text-start">שלב</th>
              <th className="px-2 py-2 text-start">מוסד · שנה</th>
              <th className="px-2 py-2 text-start">ממוצע</th>
              <th className="px-2 py-2 text-start">קבצים</th>
              <th className="px-2 py-2 text-start">הוגש</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = isOverdueForReply(r.appliedAt, r.stage, 14);
              return (
                <tr key={r.applicationId} className="h-10 border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-2">
                    <input type="checkbox" checked={selected.has(r.applicationId)} onChange={() => toggleRow(r.applicationId)} />
                  </td>
                  <td className="px-2">
                    <Link href={`/admin/candidates/${r.applicationId}`} className="font-medium text-neutral-900 hover:underline">
                      {r.firstName} {r.lastName}
                    </Link>
                    <div className="mt-0.5 flex gap-1">
                      {r.dupPhone && <Badge tone="warning">טלפון כפול</Badge>}
                      {!r.canWorkRishon && <Badge tone="warning">לא בראשון</Badge>}
                    </div>
                  </td>
                  <td className="px-2">
                    <ScoreBandPill band={r.confidence !== null && r.confidence < 0.6 ? "unknown" : scoreBand(r.scoreOverall)}>
                      {formatScore(r.scoreOverall)}
                    </ScoreBandPill>
                  </td>
                  <td className="px-2">
                    <div className="flex gap-2">
                      <ScoreBar label="חשיבה" value={r.scoreReasoning} />
                      <ScoreBar label="עצמאות" value={r.scoreIndependence} />
                      <ScoreBar label="טכנולוגי" value={r.scoreTech} />
                      <ScoreBar label="מהירות" value={r.scoreSpeed} />
                    </div>
                  </td>
                  <td className="px-2">
                    {r.integrityRisk && <IntegrityPill risk={r.integrityRisk}>{INTEGRITY_LABELS_HE[r.integrityRisk]}</IntegrityPill>}
                  </td>
                  <td className="px-2 ltr-inline">{r.pctRank !== null ? Math.round(r.pctRank * 100) : "—"}</td>
                  <td className="px-2">
                    <form action={changeStageAction} className="flex items-center gap-1">
                      <input type="hidden" name="applicationId" value={r.applicationId} />
                      <select
                        name="toStage"
                        defaultValue={r.stage}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded-md border border-neutral-200 bg-transparent px-1 py-0.5 text-xs"
                      >
                        {STAGE_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS_HE[s]}
                          </option>
                        ))}
                      </select>
                    </form>
                    {overdue && <Badge tone="warning">עבר מועד התשובה</Badge>}
                  </td>
                  <td className="px-2 text-xs">
                    {r.institution} · שנה {r.studyYear}
                  </td>
                  <td className="px-2 text-xs text-neutral-500">{r.academicAverage}</td>
                  <td className="px-2 text-xs">
                    <span title="קורות חיים">{r.hasCv ? "📄" : "—"}</span>{" "}
                    <span title="GitHub">{r.hasGithub ? "🔗" : "—"}</span>{" "}
                    <span title="LinkedIn">{r.hasLinkedin ? "💼" : "—"}</span>
                  </td>
                  <td className="px-2 text-xs text-neutral-500" title={formatDate(r.appliedAt)}>
                    {formatRelativeTime(r.appliedAt)}
                  </td>
                  <td className="px-2 text-xs">
                    <StagePill>{STAGE_LABELS_HE[r.stage]}</StagePill>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="p-6 text-center text-sm text-neutral-400">
                  אין מועמדים התואמים את הסינון.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <label className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={selectAllFiltered}
            onChange={(e) => {
              setSelectAllFiltered(e.target.checked);
              if (e.target.checked) setSelected(new Set());
            }}
          />
          בחר את כל התוצאות של הסינון (עד 5,000)
        </label>
      )}

      <dialog ref={confirmDialogRef} className="rounded-md p-0 backdrop:bg-black/30">
        <div className="w-80 p-5" dir="rtl">
          <h2 className="text-sm font-semibold text-red-800">ארכב ומחק</h2>
          <p className="mt-2 text-xs text-neutral-600">
            הפעולה תייצא CSV של המועמדים הנבחרים ולאחר מכן תמחק אותם לצמיתות (מלבד מועמדים
            שהתקבלו או מסומנים לשמירה לתמיד). לא ניתן לבטל.
          </p>
          {!selectAllFiltered && (
            <>
              <label className="mt-3 block text-xs text-neutral-600">
                הקלד/י {selected.size} כדי לאשר
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                dir="ltr"
                className="ltr-inline mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </>
          )}
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <button
              onClick={() => {
                confirmDialogRef.current?.close();
                setConfirmText("");
              }}
              className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50"
            >
              ביטול
            </button>
            <button
              onClick={confirmArchiveDelete}
              disabled={(!selectAllFiltered && confirmText !== String(selected.size)) || isPending}
              className="rounded-md bg-red-700 px-3 py-1 text-white disabled:opacity-40"
            >
              מחק לצמיתות
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
