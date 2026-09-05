"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { DEGREE_PROGRAMS, INSTITUTIONS, STUDY_YEARS } from "@/lib/reference-data";
import { submitPersonalDetailsAction, type PersonalDetailsActionState } from "./actions";

// See actions.ts's note: initial state lives here, not exported from the
// "use server" module (which may only export async functions).
const initialPersonalDetailsState: PersonalDetailsActionState = {
  errors: {},
  formError: null,
  outcome: null,
};

// CANDIDATE_FLOW.md §2.1: one-column form, labels above inputs, LTR inputs
// for phone/email/URL, inline validation, sessionStorage autosave, async CV
// upload. §2.4: the resume-code success card replaces the form in place
// (see the "created" outcome branch) rather than redirecting, since the
// plaintext resume code only ever exists in this one response.

const SESSION_STORAGE_KEY = "apply-step1-draft";

interface DraftValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  institution: string;
  degreeProgram: string;
  studyYear: string;
  academicAverage: string;
  canWorkRishon: string;
  linkedinUrl: string;
  githubUrl: string;
}

const EMPTY_DRAFT: DraftValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  institution: "",
  degreeProgram: "",
  studyYear: "",
  academicAverage: "",
  canWorkRishon: "",
  linkedinUrl: "",
  githubUrl: "",
};

function loadDraft(): DraftValues {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) };
  } catch {
    return EMPTY_DRAFT;
  }
}

interface PendingCvState {
  pendingPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hex: string;
  kind: "pdf" | "docx";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 py-3 font-medium text-white disabled:opacity-50"
    >
      {pending ? "שולח…" : "שליחת מועמדות"}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

export function PersonalDetailsForm({ jobSlug, prefillEmail }: { jobSlug: string; prefillEmail?: string }) {
  const boundAction = submitPersonalDetailsAction.bind(null, jobSlug);
  const [state, formAction] = useActionState<PersonalDetailsActionState, FormData>(
    boundAction,
    initialPersonalDetailsState,
  );
  const [draft, setDraft] = useState<DraftValues>(EMPTY_DRAFT);
  const [cvStatus, setCvStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [cvError, setCvError] = useState<string | null>(null);
  const [pendingCv, setPendingCv] = useState<PendingCvState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const loaded = loadDraft();
    if (prefillEmail) loaded.email = prefillEmail;
    setDraft(loaded);
  }, [prefillEmail]);

  function updateField<K extends keyof DraftValues>(key: K, value: string) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage unavailable (private mode) — draft just won't persist.
      }
      return next;
    });
  }

  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvStatus("uploading");
    setCvError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cv/upload", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "העלאת הקובץ נכשלה");
      }
      const data = (await res.json()) as {
        pendingPath: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        sha256Hex: string;
      };
      const kind: "pdf" | "docx" = data.mimeType === "application/pdf" ? "pdf" : "docx";
      setPendingCv({ ...data, kind });
      setCvStatus("done");
    } catch (err) {
      setCvStatus("error");
      setCvError(err instanceof Error ? err.message : "העלאת הקובץ נכשלה");
    }
  }

  if (state.outcome?.kind === "already_completed") {
    return (
      <div className="rounded-md border border-neutral-200 p-6 text-center">
        <p>
          כבר השלמת את התהליך למשרת &quot;{state.outcome.jobTitle}&quot;. נחזור אליך עד{" "}
          <Term>{state.outcome.responseByDateHe}</Term>.
        </p>
      </div>
    );
  }

  if (state.outcome?.kind === "redirect_to_resume") {
    return (
      <div className="rounded-md border border-neutral-200 p-6 text-center">
        <p>כבר הגשת מועמדות עם האימייל הזה למשרה זו.</p>
        <p className="mt-2">הזינו את קוד החזרה או בקשו קוד למייל כדי להמשיך מאותה נקודה.</p>
        <Link
          href={{ pathname: "/resume", query: { email: state.outcome.email } }}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          למעבר לעמוד החזרה
        </Link>
      </div>
    );
  }

  if (state.outcome?.kind === "created") {
    const o = state.outcome;
    return (
      <div className="rounded-md border-2 border-neutral-900 p-6" data-testid="resume-code-card">
        <h2 className="text-lg font-semibold">המועמדות התקבלה!</h2>
        <p className="mt-2">
          קוד החזרה שלך: <Term><strong data-testid="resume-code">{o.resumeCodeDisplay}</strong></Term>
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          שמרו אותו. אם תסגרו את הדפדפן או תעברו למחשב אחר, תוכלו להמשיך מאותה נקודה ב-
          <Term>/resume</Term> עם האימייל והקוד הזה.
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(o.resumeCodeDisplay)}
          className="mt-2 text-sm underline"
        >
          העתקת הקוד
        </button>
        <p className="mt-4">נחזור אליך עד <Term>{o.responseByDateHe}</Term>, בכל מקרה.</p>
        {!o.cvAttached && o.cvError ? (
          <p className="mt-2 text-sm text-amber-700">קובץ קורות החיים לא צורף בהצלחה. אפשר להמשיך בלעדיו.</p>
        ) : null}
        <Link
          href={`/apply/${o.applicationId}/job`}
          className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-3 font-medium text-white"
          data-testid="continue-to-step2"
        >
          המשך לשלב הבא
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <p className="text-sm text-neutral-500">כ-3 דקות · הטופס נשמר בדפדפן בזמן המילוי</p>

      {state.formError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.formError}</p>
      ) : null}

      <div>
        <label htmlFor="firstName" className="block text-sm font-medium">שם פרטי</label>
        <input
          id="firstName"
          name="firstName"
          value={draft.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
          required
        />
        <FieldError message={state.errors.firstName} />
      </div>

      <div>
        <label htmlFor="lastName" className="block text-sm font-medium">שם משפחה</label>
        <input
          id="lastName"
          name="lastName"
          value={draft.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
          required
        />
        <FieldError message={state.errors.lastName} />
      </div>

      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium">תאריך לידה</label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          dir="ltr"
          value={draft.dateOfBirth}
          onChange={(e) => updateField("dateOfBirth", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
          required
        />
        <FieldError message={state.errors.dateOfBirth} />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">טלפון נייד</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          dir="ltr"
          placeholder="050-1234567"
          value={draft.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
          required
        />
        <FieldError message={state.errors.phone} />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">אימייל</label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          placeholder="name@example.com"
          value={draft.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
          required
        />
        <FieldError message={state.errors.email} />
      </div>

      <div>
        <label htmlFor="institution" className="block text-sm font-medium">מוסד לימודים</label>
        <input
          id="institution"
          name="institution"
          list="institutions-list"
          value={draft.institution}
          onChange={(e) => updateField("institution", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
          required
        />
        <datalist id="institutions-list">
          {INSTITUTIONS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <FieldError message={state.errors.institution} />
      </div>

      <div>
        <label htmlFor="degreeProgram" className="block text-sm font-medium">תואר / מסלול</label>
        <input
          id="degreeProgram"
          name="degreeProgram"
          list="degree-programs-list"
          value={draft.degreeProgram}
          onChange={(e) => updateField("degreeProgram", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
          required
        />
        <datalist id="degree-programs-list">
          {DEGREE_PROGRAMS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <FieldError message={state.errors.degreeProgram} />
      </div>

      <div>
        <label htmlFor="studyYear" className="block text-sm font-medium">שנת לימוד נוכחית</label>
        <select
          id="studyYear"
          name="studyYear"
          value={draft.studyYear}
          onChange={(e) => updateField("studyYear", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
          required
        >
          <option value="" disabled>בחרו שנת לימוד</option>
          {STUDY_YEARS.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
        <FieldError message={state.errors.studyYear} />
      </div>

      <div>
        <label htmlFor="academicAverage" className="block text-sm font-medium">ממוצע ציונים נוכחי</label>
        <input
          id="academicAverage"
          name="academicAverage"
          type="number"
          dir="ltr"
          min={0}
          max={100}
          step={0.1}
          value={draft.academicAverage}
          onChange={(e) => updateField("academicAverage", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
          required
        />
        <p className="mt-1 text-sm text-neutral-500">הממוצע נשמר כנתון עזר בלבד ואינו פוסל מועמדות</p>
        <FieldError message={state.errors.academicAverage} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">יכולת לעבוד מראשון לציון (פיזית, בהיברידי)</legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="canWorkRishon"
              value="yes"
              checked={draft.canWorkRishon === "yes"}
              onChange={(e) => updateField("canWorkRishon", e.target.value)}
              required
            />
            כן
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="canWorkRishon"
              value="no"
              checked={draft.canWorkRishon === "no"}
              onChange={(e) => updateField("canWorkRishon", e.target.value)}
            />
            לא
          </label>
        </div>
        {draft.canWorkRishon === "no" ? (
          <p className="mt-1 text-sm text-amber-700">
            המשרה דורשת נוכחות באזור ראשון לציון. אפשר להמשיך, אבל זה ייכלל בשיקולים.
          </p>
        ) : null}
        <FieldError message={state.errors.canWorkRishon} />
      </fieldset>

      <div>
        <label htmlFor="linkedinUrl" className="block text-sm font-medium">
          <Term>LinkedIn</Term> (לא חובה)
        </label>
        <input
          id="linkedinUrl"
          name="linkedinUrl"
          type="text"
          dir="ltr"
          placeholder="https://www.linkedin.com/in/..."
          value={draft.linkedinUrl}
          onChange={(e) => updateField("linkedinUrl", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
        />
        <FieldError message={state.errors.linkedinUrl} />
      </div>

      <div>
        <label htmlFor="githubUrl" className="block text-sm font-medium">
          <Term>GitHub</Term> (לא חובה)
        </label>
        <input
          id="githubUrl"
          name="githubUrl"
          type="text"
          dir="ltr"
          placeholder="https://github.com/..."
          value={draft.githubUrl}
          onChange={(e) => updateField("githubUrl", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
        />
        <FieldError message={state.errors.githubUrl} />
      </div>

      <div>
        <label htmlFor="cv" className="block text-sm font-medium">קורות חיים (לא חובה, PDF או DOCX עד 5MB)</label>
        <input id="cv" type="file" accept=".pdf,.docx" onChange={handleCvChange} className="mt-1 w-full" />
        {cvStatus === "uploading" ? <p className="mt-1 text-sm text-neutral-500">מעלה קובץ…</p> : null}
        {cvStatus === "done" ? <p className="mt-1 text-sm text-green-700">הקובץ הועלה בהצלחה</p> : null}
        {cvStatus === "error" ? (
          <p className="mt-1 text-sm text-red-600">{cvError} — אפשר להמשיך בלי קורות חיים</p>
        ) : null}
        <input type="hidden" name="pendingCvId" value={pendingCv ? JSON.stringify(pendingCv) : ""} />
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="privacyConsent" required className="mt-1" />
          <span>
            קראתי ואני מסכים/ה ל<Link href="/privacy" className="underline">מדיניות הפרטיות</Link>
          </span>
        </label>
        <FieldError message={state.errors.privacyConsent} />
      </div>

      <SubmitButton />
    </form>
  );
}
