"use client";

import { useState } from "react";
import type { JobDetail, AssessmentConfigOption } from "../../../../db/queries/jobs";
import { createJobAction, updateJobAction, deleteJobAction } from "./actions";

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// ADMIN_UX.md §5: the job create/edit form — commercial "כרטיס תנאים"
// fields, 3 editable confirmation sentences, assessment config picker,
// response window + closure-email toggle, active toggle, delete-only-if-
// empty. Slug auto-derives from the Hebrew title until the admin edits it
// directly (the one bit of client interactivity this form needs).
export function JobFormClient({
  job,
  configs,
}: {
  job: JobDetail | null;
  configs: AssessmentConfigOption[];
}) {
  const [title, setTitle] = useState(job?.titleHe ?? "");
  const [slug, setSlug] = useState(job?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!job);
  const [confirmations, setConfirmations] = useState<string[]>(
    job?.confirmationsHe.length ? job.confirmationsHe : ["", "", ""],
  );
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const action = job ? updateJobAction : createJobAction;

  return (
    <form action={action} className="flex flex-col gap-4 text-sm" dir="rtl">
      {job && <input type="hidden" name="id" value={job.id} />}

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">כותרת (עברית)</span>
        <input
          name="titleHe"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-md border border-neutral-300 px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">כותרת (אנגלית, אופציונלי)</span>
        <input name="titleEn" defaultValue={job?.titleEn ?? ""} dir="ltr" className="ltr-inline rounded-md border border-neutral-300 px-2 py-1.5" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">כתובת (slug)</span>
        <input
          name="slug"
          required
          value={slug}
          dir="ltr"
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="ltr-inline rounded-md border border-neutral-300 px-2 py-1.5 font-mono"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">תקציר (שורה אחת)</span>
        <input name="summaryHe" required defaultValue={job?.summaryHe ?? ""} className="rounded-md border border-neutral-300 px-2 py-1.5" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">תיאור (markdown)</span>
        <textarea name="descriptionHe" required rows={8} defaultValue={job?.descriptionHe ?? ""} className="rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-xs" />
      </label>

      <fieldset className="rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-xs font-medium text-neutral-500">כרטיס תנאים</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField name="hourlyRateIls" label="שכר לשעה (₪)" defaultValue={job?.hourlyRateIls} />
          <NumField name="hoursPerWeek" label="שעות בשבוע" defaultValue={job?.hoursPerWeek} />
          <NumField name="daysPerWeek" label="ימים בשבוע" defaultValue={job?.daysPerWeek} />
          <NumField name="hoursPerDay" label="שעות ביום" defaultValue={job?.hoursPerDay} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">סוג העסקה</span>
            <input name="engagementTypeHe" defaultValue={job?.engagementTypeHe ?? "קבלן עצמאי / נותן שירותים"} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">מיקום</span>
            <input name="locationHe" required defaultValue={job?.locationHe ?? "ראשון לציון והסביבה"} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">היברידיות</span>
            <input name="hybridHe" defaultValue={job?.hybridHe ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">התחלה</span>
            <input name="startHe" defaultValue={job?.startHe ?? "מיידי"} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-1.5">
          <input type="checkbox" name="requiresRishon" defaultChecked={job?.requiresRishon ?? true} />
          דורש/ת נוכחות בראשון לציון (משפיע רק על התג; השאלה נשאלת תמיד)
        </label>
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-xs font-medium text-neutral-500">אישורי הבנה (3 משפטים)</legend>
        {confirmations.map((c, i) => (
          <input
            key={i}
            name="confirmation"
            value={c}
            onChange={(e) => {
              const next = [...confirmations];
              next[i] = e.target.value;
              setConfirmations(next);
            }}
            className="mb-1.5 w-full rounded-md border border-neutral-300 px-2 py-1"
          />
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">תצורת מבחן</span>
        <select name="assessmentConfigId" required defaultValue={job?.assessmentConfigId ?? configs[0]?.id} className="rounded-md border border-neutral-300 px-2 py-1.5">
          {configs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameHe}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">שינוי תצורה אחרי שהוגשו מועמדויות משפיע רק על מבחנים חדשים. תצורה חדשה דורשת מפתח/ת.</span>
      </label>

      <div className="flex items-center gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-neutral-700">מועד תשובה מובטח (ימים)</span>
          <input type="number" name="responseWindowDays" min={1} defaultValue={job?.responseWindowDays ?? 14} className="w-24 rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="mt-5 flex items-center gap-1.5">
          <input type="checkbox" name="sendRejectionEmail" defaultChecked={job?.sendRejectionEmail ?? true} />
          שלח הודעת סיום בדחייה
        </label>
      </div>

      <label className="flex items-center gap-1.5">
        <input type="checkbox" name="isActive" defaultChecked={job?.isActive ?? false} />
        פעיל
      </label>
      {job?.applicationCount ? (
        <p className="text-xs text-neutral-400">{job.applicationCount} מועמדים במשרה זו כרגע — השבתה לא תמנע מהם לסיים תהליך שהתחילו.</p>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-1.5 text-white hover:bg-neutral-700">
          שמור
        </button>
        {job && (
          <a href={`/jobs/${slug}?preview=1`} target="_blank" rel="noreferrer" className="rounded-md border border-neutral-300 px-4 py-1.5 hover:bg-neutral-50">
            תצוגה מקדימה
          </a>
        )}
      </div>

      {job && (
        <div className="mt-4 border-t border-neutral-200 pt-3">
          <button
            type="button"
            onClick={async () => {
              const fd = new FormData();
              fd.set("id", job.id);
              const before = job.applicationCount;
              await deleteJobAction(fd);
              if (before > 0) setDeleteBlocked(true);
            }}
            className="text-xs text-red-700 underline hover:text-red-900"
          >
            מחק משרה (רק ללא מועמדויות)
          </button>
          {deleteBlocked && <p className="mt-1 text-xs text-red-700">לא ניתן למחוק משרה עם מועמדויות קיימות — יש להשבית במקום.</p>}
        </div>
      )}
    </form>
  );
}

function NumField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number | null | undefined }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <input type="number" step="0.1" name={name} defaultValue={defaultValue ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
    </label>
  );
}
