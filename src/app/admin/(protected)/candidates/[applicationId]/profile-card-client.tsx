"use client";

import { useRef, useState, useTransition } from "react";
import type { CandidateProfile, OtherApplication } from "../../../../../db/queries/candidate-detail";
import { STAGE_LABELS_HE, STAGE_ORDER, ageFromDob, formatDate, responseDueDate, isOverdueForReply } from "../../../../../lib/admin-format";
import { Badge } from "../../../../../components/admin/pill";
import { changeStageAction, toggleKeepIndefiniteAction } from "../actions";
import { resetAssessmentAction, deleteCandidateAction, getCvDownloadUrlAction } from "./actions";

// ADMIN_UX.md §4.1: the fixed profile card (personal/academic info, CV via
// signed URL, stage selector with the "שלח הודעת סיום" checkbox on
// rejection, danger zone). A client component for the interactive bits
// (conditional checkbox, CV signed-URL fetch, typed-confirmation delete).
export function ProfileCardClient({
  profile,
  otherApplications,
}: {
  profile: CandidateProfile;
  otherApplications: OtherApplication[];
}) {
  const [pendingStage, setPendingStage] = useState(profile.stage);
  const [isPending, startTransition] = useTransition();
  const [cvError, setCvError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [resetReason, setResetReason] = useState("");
  const resetDialogRef = useRef<HTMLDialogElement>(null);

  const dueDate = responseDueDate(profile.appliedAt, profile.responseWindowDays);
  const overdue = isOverdueForReply(profile.appliedAt, profile.stage, profile.responseWindowDays);

  async function downloadCv() {
    if (!profile.cvObjectPath) return;
    setCvError(null);
    try {
      const url = await getCvDownloadUrlAction(profile.cvObjectPath);
      if (!url) {
        setCvError("לא ניתן להוריד את קורות החיים כרגע.");
        return;
      }
      window.open(url, "_blank");
    } catch {
      setCvError("לא ניתן להוריד את קורות החיים כרגע.");
    }
  }

  return (
    <aside className="w-full shrink-0 rounded-md border border-neutral-200 bg-white p-4 lg:w-80" dir="rtl">
      <h2 className="text-lg font-semibold text-neutral-900">
        {profile.firstName} {profile.lastName}
      </h2>
      <p className="text-sm text-neutral-500" title={formatDate(profile.dateOfBirth)}>
        גיל {ageFromDob(profile.dateOfBirth)}
      </p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="טלפון">
          <a dir="ltr" className="ltr-inline hover:underline" href={`tel:${profile.phoneE164}`}>
            {profile.phoneE164}
          </a>
        </Row>
        <Row label="אימייל">
          <a dir="ltr" className="ltr-inline hover:underline" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
        </Row>
        <Row label="מוסד">{profile.institution}</Row>
        <Row label="תואר">{profile.degreeProgram}</Row>
        <Row label="שנה">{profile.studyYear}</Row>
        <Row label="ממוצע">{profile.academicAverage}</Row>
        <Row label="זמינות בראשון">
          {profile.canWorkRishon ? "כן" : <Badge tone="warning">לא</Badge>}
        </Row>
        {profile.linkedinUrl && (
          <Row label="LinkedIn">
            <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="ltr-inline hover:underline" dir="ltr">
              פרופיל
            </a>
          </Row>
        )}
        {profile.githubUrl && (
          <Row label="GitHub">
            <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="ltr-inline hover:underline" dir="ltr">
              פרופיל
            </a>
          </Row>
        )}
        <Row label="קורות חיים">
          {profile.cvObjectPath ? (
            <button onClick={downloadCv} className="text-sky-700 underline hover:text-sky-900">
              הורד קורות חיים
            </button>
          ) : (
            "לא הועלה"
          )}
        </Row>
        {cvError && <p className="text-xs text-red-700">{cvError}</p>}
        <Row label="משרה">{profile.jobTitleHe}</Row>
        <Row label="הוגש בתאריך">{formatDate(profile.appliedAt)}</Row>
      </dl>

      {profile.duplicatePhoneOf && (
        <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          טלפון זהה למועמד/ת{" "}
          <a href={`/admin/candidates?q=${encodeURIComponent(profile.duplicatePhoneOfName ?? "")}`} className="underline">
            {profile.duplicatePhoneOfName}
          </a>
        </p>
      )}

      {otherApplications.length > 0 && (
        <div className="mt-3 text-xs text-neutral-500">
          מועמדויות נוספות:
          <ul className="mt-1 space-y-0.5">
            {otherApplications.map((a) => (
              <li key={a.applicationId}>
                <a href={`/admin/candidates/${a.applicationId}`} className="underline">
                  {a.jobTitleHe} — {STAGE_LABELS_HE[a.stage]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-neutral-200 pt-3">
        <form
          action={(fd) => {
            fd.set("applicationId", profile.applicationId);
            startTransition(() => changeStageAction(fd));
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-xs font-medium text-neutral-600">שלב</label>
          <select
            name="toStage"
            value={pendingStage}
            onChange={(e) => setPendingStage(e.target.value as typeof pendingStage)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS_HE[s]}
              </option>
            ))}
          </select>
          {pendingStage === "rejected" && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              <input type="checkbox" name="queueRejectionEmail" defaultChecked={profile.sendRejectionEmail} />
              שלח הודעת סיום
            </label>
          )}
          <button type="submit" disabled={isPending} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            עדכן שלב
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          מועד תשובה עד {formatDate(dueDate)} {overdue && <Badge tone="warning">עבר מועד התשובה</Badge>}
        </p>
        {profile.rejectionEmailSentAt && (
          <p className="mt-1 text-xs text-neutral-400">הודעת סיום נשלחה ב-{formatDate(profile.rejectionEmailSentAt)}</p>
        )}
      </div>

      <form
        action={(fd) => {
          fd.set("applicationId", profile.applicationId);
          fd.set("value", profile.keepIndefinitely ? "0" : "1");
          startTransition(() => toggleKeepIndefiniteAction(fd));
        }}
        className="mt-2"
      >
        <button type="submit" className="text-xs text-neutral-500 underline hover:text-neutral-900">
          {profile.keepIndefinitely ? "בטל שמירה לתמיד" : "שמור לתמיד (החרג ממחיקה אוטומטית)"}
        </button>
      </form>

      <details className="mt-4 rounded-md border border-red-200">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-red-700">אזור מסוכן</summary>
        <div className="flex flex-col gap-2 border-t border-red-100 p-3">
          <button
            onClick={() => resetDialogRef.current?.showModal()}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            אפס מבחן
          </button>
          <button
            onClick={() => deleteDialogRef.current?.showModal()}
            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            מחק מועמד
          </button>
        </div>
      </details>

      <dialog ref={resetDialogRef} className="rounded-md p-0 backdrop:bg-black/30">
        <form
          action={(fd) => {
            fd.set("applicationId", profile.applicationId);
            startTransition(async () => {
              await resetAssessmentAction(fd);
              resetDialogRef.current?.close();
            });
          }}
          className="w-72 p-4"
          dir="rtl"
        >
          <h3 className="text-sm font-semibold">איפוס מבחן</h3>
          <p className="mt-1 text-xs text-neutral-500">המבחן הנוכחי יימחק והמועמד/ת יחזרו לשלב &quot;הוגשה מועמדות&quot;.</p>
          <input
            type="text"
            name="reason"
            required
            placeholder="סיבת האיפוס"
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => resetDialogRef.current?.close()} className="rounded-md border border-neutral-300 px-3 py-1">
              ביטול
            </button>
            <button type="submit" disabled={!resetReason.trim()} className="rounded-md bg-neutral-900 px-3 py-1 text-white disabled:opacity-40">
              אפס
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteDialogRef} className="rounded-md p-0 backdrop:bg-black/30">
        <form
          action={(fd) => {
            fd.set("candidateId", profile.candidateId);
            startTransition(async () => {
              await deleteCandidateAction(fd);
              window.location.href = "/admin/candidates";
            });
          }}
          className="w-72 p-4"
          dir="rtl"
        >
          <h3 className="text-sm font-semibold text-red-800">מחיקת מועמד</h3>
          <p className="mt-1 text-xs text-neutral-500">
            כל מועמדויות {profile.firstName} {profile.lastName} יימחקו לצמיתות. הקלד/י &quot;מחק&quot; כדי לאשר.
          </p>
          <input
            type="text"
            dir="ltr"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="ltr-inline mt-2 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => deleteDialogRef.current?.close()} className="rounded-md border border-neutral-300 px-3 py-1">
              ביטול
            </button>
            <button type="submit" disabled={deleteConfirm !== "מחק"} className="rounded-md bg-red-700 px-3 py-1 text-white disabled:opacity-40">
              מחק לצמיתות
            </button>
          </div>
        </form>
      </dialog>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{children}</dd>
    </div>
  );
}
