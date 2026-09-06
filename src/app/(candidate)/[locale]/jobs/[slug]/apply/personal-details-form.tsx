"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { Button, buttonClasses, PAGE_CTA_WIDTH_CLASS } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Field, FieldLabel, Input, Select } from "@/components/ui/field";
import { ResumeCodeRow } from "@/components/ui/resume-code-row";
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
//
// FINTECH_REDESIGN_PLAN.md §R2.2 step 1 item 3 / §R2.3.5: fields are grouped
// into four sections inside one Card — "פרטי קשר", "לימודים", "זמינות",
// "לא חובה — אבל עוזר לנו" — using real section headings (15/24 600
// --ink-900, the shared `.section-heading` class) instead of round 1's 13px
// grey group labels, with two-up field rows at >=480px.

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
    <Button type="submit" pending={pending}>
      {pending ? "שומר…" : "שמירה והמשך"}
    </Button>
  );
}

// FINTECH_REDESIGN_PLAN.md §R2.3.5: the reusable form-section-heading
// pattern (15/24 600 --ink-900, `.section-heading` in globals.css),
// replacing round 1's 13px grey `GroupLabel`. Every section but the first
// gets the `pt-6 mt-6 border-t border-line` spacing the plan specifies.
function SectionHeading({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <h3 className={`section-heading ${first ? "" : "mt-6 border-t border-line pt-6"}`}>{children}</h3>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-text-3" fill="none" aria-hidden="true">
      <path
        d="M12 15V4m0 0L8 8m4-4l4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// FINTECH_REDESIGN_PLAN.md §R2.2 step 1 item 6: a 130px dashed box was the
// largest element on the page for an optional field. Compact: icon, text
// and chip on one row, ~64px tall.
function CvDropzone({
  status,
  error,
  onFileSelected,
}: {
  status: "idle" | "uploading" | "done" | "error";
  error: string | null;
  onFileSelected: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div>
      <label
        htmlFor="cv"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFileSelected(file);
        }}
        className={`rtl-row cursor-pointer items-center gap-3 rounded-12 border-[1.5px] border-dashed px-4 py-4 text-start transition-colors duration-150 ${
          dragOver ? "border-brand-600 bg-brand-50" : "border-line-strong bg-surface hover:bg-canvas"
        }`}
      >
        <UploadIcon />
        <span className="min-w-0 flex-1 text-[15px] leading-6 text-text">גררו קובץ או לחצו לבחירה</span>
        <Chip>PDF או DOCX · עד 5MB</Chip>
        <input
          id="cv"
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
          }}
        />
      </label>

      {status === "uploading" ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-label="מעלה קובץ">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-600" />
        </div>
      ) : null}
      {status === "done" ? (
        <Callout variant="success" className="mt-2">
          הקובץ הועלה בהצלחה
        </Callout>
      ) : null}
      {status === "error" ? (
        <Callout variant="error" className="mt-2">
          {error} — אפשר להמשיך בלי קורות חיים
        </Callout>
      ) : null}
    </div>
  );
}

// FINTECH_REDESIGN_PLAN.md §R2.2 done/step-1 item 7(d): a 48px mint disc
// with a white check, not just a color change.
function CheckDisc() {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint-600"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PersonalDetailsForm({
  jobSlug,
  prefillEmail,
  onOutcomeChange,
}: {
  jobSlug: string;
  prefillEmail?: string;
  onOutcomeChange?: (succeeded: boolean) => void;
}) {
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

  // §R2.2 step-1 item 7(a): the header stepper (not an inner one) reflects
  // the "created" outcome via `currentAlsoDone` — see step1-shell.tsx.
  useEffect(() => {
    onOutcomeChange?.(state.outcome?.kind === "created");
  }, [state.outcome, onOutcomeChange]);

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

  async function handleCvFile(file: File) {
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
      <Card className="text-center">
        <p className="text-[16px] leading-[26px] text-text">
          כבר השלמת את התהליך למשרת &quot;{state.outcome.jobTitle}&quot;. נחזור אליך עד{" "}
          <Term>{state.outcome.responseByDateHe}</Term>.
        </p>
      </Card>
    );
  }

  if (state.outcome?.kind === "redirect_to_resume") {
    return (
      <Card className="text-center">
        <p className="text-[16px] leading-[26px] text-text">כבר הגשת מועמדות עם האימייל הזה למשרה זו.</p>
        <p className="mt-2 text-[14px] leading-[22px] text-text-2">
          הזינו את קוד החזרה או בקשו קוד למייל כדי להמשיך מאותה נקודה.
        </p>
        <Link
          href={{ pathname: "/resume", query: { email: state.outcome.email } }}
          className={buttonClasses({ className: "mt-4" })}
        >
          למעבר לעמוד החזרה
        </Link>
      </Card>
    );
  }

  if (state.outcome?.kind === "created") {
    const o = state.outcome;
    return (
      <Card>
        {/* §R2.2 step-1 item 7: no inner stepper (the header stepper carries
            that now); a page eyebrow without step-count numbers (the
            landing counts 3 steps, the stepper 4 — showing both totals to
            the candidate is confusing, not reassuring); its own H1 with a
            mint check disc, per the same treatment as the done page. */}
        <p className="eyebrow">השלב הראשון הושלם</p>
        <div className="rtl-row mt-2 items-center gap-4">
          <CheckDisc />
          <h1 className="h1">הפרטים נשמרו</h1>
        </div>
        <p className="mt-3 text-[18px] leading-7 text-text-2">
          השלב הבא: התפקיד והמבחן — המועמדות נבחנת רק אחרי המבחן המקוון (כ-20 דקות, במחשב).
        </p>

        <Link
          href={`/apply/${o.applicationId}/job`}
          className={buttonClasses({ size: "lg", fullWidth: false, className: `mt-6 ${PAGE_CTA_WIDTH_CLASS}` })}
          data-testid="continue-to-step2"
        >
          ממשיכים לתיאור התפקיד
        </Link>

        <ResumeCodeRow
          code={o.resumeCodeDisplay}
          helper={
            <>
              אם תצטרכו לעצור באמצע, האימייל והקוד מחזירים אתכם לאותה נקודה ב
              <Link href="/resume" className="text-brand-600 underline hover:text-brand-700">
                עמוד החזרה לתהליך
              </Link>
              . שלחנו אותו גם למייל.
            </>
          }
        />

        {!o.cvAttached && o.cvError ? (
          <Callout variant="warning" className="mt-4">
            קובץ קורות החיים לא צורף בהצלחה. אפשר להמשיך בלעדיו.
          </Callout>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <form ref={formRef} action={formAction} noValidate>
        {state.formError ? <Callout variant="error" className="mb-6">{state.formError}</Callout> : null}

        <div className="space-y-5">
          <SectionHeading first>פרטי קשר</SectionHeading>

          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
            <Field label="שם פרטי" htmlFor="firstName" error={state.errors.firstName}>
              <Input
                id="firstName"
                name="firstName"
                value={draft.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                error={!!state.errors.firstName}
                required
              />
            </Field>

            <Field label="שם משפחה" htmlFor="lastName" error={state.errors.lastName}>
              <Input
                id="lastName"
                name="lastName"
                value={draft.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                error={!!state.errors.lastName}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
            <Field label="תאריך לידה" htmlFor="dateOfBirth" error={state.errors.dateOfBirth}>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                dir="ltr"
                className="text-start min-[480px]:max-w-[220px]"
                value={draft.dateOfBirth}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                error={!!state.errors.dateOfBirth}
                required
              />
            </Field>

            <Field label="טלפון נייד" htmlFor="phone" error={state.errors.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                className="text-start"
                placeholder="050-1234567"
                value={draft.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                error={!!state.errors.phone}
                required
              />
            </Field>
          </div>

          <Field label="אימייל" htmlFor="email" error={state.errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              className="text-start"
              placeholder="name@example.com"
              value={draft.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={!!state.errors.email}
              required
            />
          </Field>
        </div>

        <div className="space-y-5">
          <SectionHeading>לימודים</SectionHeading>

          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
            <Field label="מוסד לימודים" htmlFor="institution" error={state.errors.institution}>
              <Input
                id="institution"
                name="institution"
                list="institutions-list"
                value={draft.institution}
                onChange={(e) => updateField("institution", e.target.value)}
                error={!!state.errors.institution}
                required
              />
              <datalist id="institutions-list">
                {INSTITUTIONS.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </Field>

            <Field label="תואר / מסלול" htmlFor="degreeProgram" error={state.errors.degreeProgram}>
              <Input
                id="degreeProgram"
                name="degreeProgram"
                list="degree-programs-list"
                value={draft.degreeProgram}
                onChange={(e) => updateField("degreeProgram", e.target.value)}
                error={!!state.errors.degreeProgram}
                required
              />
              <datalist id="degree-programs-list">
                {DEGREE_PROGRAMS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
            <Field label="שנת לימוד נוכחית" htmlFor="studyYear" error={state.errors.studyYear}>
              <Select
                id="studyYear"
                name="studyYear"
                value={draft.studyYear}
                onChange={(e) => updateField("studyYear", e.target.value)}
                required
              >
                <option value="" disabled>
                  בחרו שנת לימוד
                </option>
                {STUDY_YEARS.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="ממוצע ציונים נוכחי"
              htmlFor="academicAverage"
              error={state.errors.academicAverage}
              helper={state.errors.academicAverage ? undefined : "הממוצע נשמר כנתון עזר בלבד ואינו פוסל מועמדות"}
            >
              <Input
                id="academicAverage"
                name="academicAverage"
                type="number"
                dir="ltr"
                className="text-start"
                min={0}
                max={100}
                step={0.1}
                value={draft.academicAverage}
                onChange={(e) => updateField("academicAverage", e.target.value)}
                error={!!state.errors.academicAverage}
                required
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeading>זמינות</SectionHeading>
          <fieldset>
            <legend className="text-[14px] font-medium leading-[22px] text-text-2">
              זמינות להגיע לאזור ראשון לציון (היברידי)
            </legend>
            <p className="mt-1 text-[13px] leading-5 text-text-3">נדרש חלק מהשבוע; לא מרחוק בלבד</p>
            <div className="rtl-row-inline mt-2 overflow-hidden rounded-10 border border-line-strong">
              {(["yes", "no"] as const).map((val, i) => (
                <div key={val} className="relative">
                  <input
                    type="radio"
                    id={`canWorkRishon-${val}`}
                    name="canWorkRishon"
                    value={val}
                    checked={draft.canWorkRishon === val}
                    onChange={(e) => updateField("canWorkRishon", e.target.value)}
                    required={val === "yes"}
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <label
                    htmlFor={`canWorkRishon-${val}`}
                    className={`flex h-12 min-w-[120px] cursor-pointer items-center justify-center px-5 text-base font-semibold text-ink-900 transition-colors duration-150 peer-checked:bg-ink-900 peer-checked:text-white peer-focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand-600)] ${
                      i > 0 ? "border-s border-line-strong" : ""
                    }`}
                  >
                    {val === "yes" ? "כן" : "לא"}
                  </label>
                </div>
              ))}
            </div>
            {draft.canWorkRishon === "no" ? (
              <Callout variant="warning" className="mt-3">
                המשרה דורשת נוכחות באזור ראשון לציון. אפשר להמשיך, אבל זה ייכלל בשיקולים.
              </Callout>
            ) : null}
            {state.errors.canWorkRishon ? (
              <p className="mt-1 text-[13px] leading-5 text-red-600">{state.errors.canWorkRishon}</p>
            ) : null}
          </fieldset>
        </div>

        <div className="space-y-5">
          <SectionHeading>לא חובה — אבל עוזר לנו</SectionHeading>

          <Field label={<Term>LinkedIn</Term>} htmlFor="linkedinUrl" error={state.errors.linkedinUrl}>
            <Input
              id="linkedinUrl"
              name="linkedinUrl"
              type="text"
              dir="ltr"
              className="text-start"
              placeholder="https://www.linkedin.com/in/..."
              value={draft.linkedinUrl}
              onChange={(e) => updateField("linkedinUrl", e.target.value)}
              error={!!state.errors.linkedinUrl}
            />
          </Field>

          <Field label={<Term>GitHub</Term>} htmlFor="githubUrl" error={state.errors.githubUrl}>
            <Input
              id="githubUrl"
              name="githubUrl"
              type="text"
              dir="ltr"
              className="text-start"
              placeholder="https://github.com/..."
              value={draft.githubUrl}
              onChange={(e) => updateField("githubUrl", e.target.value)}
              error={!!state.errors.githubUrl}
            />
          </Field>

          <div>
            <FieldLabel htmlFor="cv">
              קורות חיים <span className="font-normal text-text-3">(לא חובה)</span>
            </FieldLabel>
            <div className="mt-1">
              <CvDropzone status={cvStatus} error={cvError} onFileSelected={handleCvFile} />
            </div>
            <input type="hidden" name="pendingCvId" value={pendingCv ? JSON.stringify(pendingCv) : ""} />
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <Checkbox
            name="privacyConsent"
            required
            label={
              <>
                קראתי ואני מסכים/ה ל
                <Link href="/privacy" className="text-brand-600 underline hover:text-brand-700">
                  מדיניות הפרטיות
                </Link>
              </>
            }
          />
          {state.errors.privacyConsent ? (
            <p className="mt-1 text-[13px] leading-5 text-red-600">{state.errors.privacyConsent}</p>
          ) : null}
        </div>

        <div className="mt-6">
          <SubmitButton />
        </div>
      </form>
    </Card>
  );
}
