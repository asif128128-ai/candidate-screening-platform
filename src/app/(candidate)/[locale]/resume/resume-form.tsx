"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Term } from "@/components/term";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, Input } from "@/components/ui/field";
import {
  requestOtpAction,
  resumeWithCodeAction,
  verifyOtpAction,
  type OtpRequestState,
  type OtpVerifyState,
  type ResumeCodeState,
} from "./actions";

// See actions.ts's note: initial state lives here, not in the "use server" module.
const initialResumeCodeState: ResumeCodeState = { errors: {}, formError: null };
const initialOtpRequestState: OtpRequestState = { errors: {}, sent: false, formError: null };
const initialOtpVerifyState: OtpVerifyState = { errors: {}, formError: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending}>
      {pending ? "בודק…" : label}
    </Button>
  );
}

export function ResumeForm({ prefillEmail }: { prefillEmail?: string }) {
  const [codeState, codeFormAction] = useActionState(resumeWithCodeAction, initialResumeCodeState);
  const [otpMode, setOtpMode] = useState(false);
  const [email, setEmail] = useState(prefillEmail ?? "");
  // FINTECH_REDESIGN_PLAN.md §R2.2 resume item 2: round 1 rendered two
  // separate "אימייל" fields on one screen (one per form). One shared field
  // now drives both: the send-code form owns it while editable; once a code
  // is sent it collapses to a static "שלחנו קוד ל-…" line (with a "לשנות
  // אימייל" ghost link back to the editable field) and the verify form
  // appears below, carrying the same email via a hidden input.
  const [emailEditing, setEmailEditing] = useState(true);
  const [otpRequestState, otpRequestFormAction] = useActionState(requestOtpAction, initialOtpRequestState);
  const [otpVerifyState, otpVerifyFormAction] = useActionState(verifyOtpAction, initialOtpVerifyState);

  useEffect(() => {
    if (otpRequestState.sent) setEmailEditing(false);
  }, [otpRequestState]);

  if (otpMode) {
    return (
      <div className="space-y-6" data-testid="otp-panel">
        <form action={otpRequestFormAction} className="space-y-4">
          {emailEditing ? (
            <>
              <Field label="אימייל" htmlFor="otp-email" error={otpRequestState.errors.email}>
                <Input
                  id="otp-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  className="text-start"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={!!otpRequestState.errors.email}
                  required
                />
              </Field>
              {otpRequestState.formError ? <Callout variant="error">{otpRequestState.formError}</Callout> : null}
              <SubmitButton label="שליחת קוד למייל" />
            </>
          ) : (
            <>
              <input type="hidden" name="email" value={email} />
              <p className="text-[14px] leading-[22px] text-text-2">
                שלחנו קוד ל-<Term>{email}</Term>.{" "}
                <button
                  type="button"
                  onClick={() => setEmailEditing(true)}
                  className="text-text-2 underline hover:text-text"
                >
                  לשנות אימייל
                </button>
              </p>
              {otpRequestState.sent ? (
                <Callout variant="success">אם קיים חשבון עם האימייל הזה, נשלח אליו קוד.</Callout>
              ) : null}
            </>
          )}
        </form>

        {!emailEditing && otpRequestState.sent ? (
          <form action={otpVerifyFormAction} className="space-y-4 border-t border-line pt-6">
            <input type="hidden" name="email" value={email} />
            <Field label="הקוד שקיבלת" htmlFor="otp-code" error={otpVerifyState.errors.code}>
              <Input
                id="otp-code"
                name="code"
                type="text"
                dir="ltr"
                className="text-start"
                inputMode="numeric"
                error={!!otpVerifyState.errors.code}
                required
              />
            </Field>
            {otpVerifyState.formError ? <Callout variant="error">{otpVerifyState.formError}</Callout> : null}
            <SubmitButton label="אימות קוד וכניסה" />
          </form>
        ) : null}

        <button type="button" onClick={() => setOtpMode(false)} className="text-[14px] text-brand-600 hover:underline">
          חזרה להזנת קוד החזרה
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={codeFormAction} className="space-y-4">
        <Field label="אימייל" htmlFor="email" error={codeState.errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            className="text-start"
            defaultValue={prefillEmail}
            placeholder="name@example.com"
            error={!!codeState.errors.email}
            required
          />
        </Field>
        {/* FINTECH_REDESIGN_PLAN.md §R2.2 resume item 1: the label used to
            put a sample code ("קוד החזרה (K7M4-Q2XP)") where it read as a
            real value. Now the sample lives only in the placeholder, with a
            mono, letter-spaced treatment matching the code's own format. */}
        <Field label="קוד החזרה" htmlFor="code" error={codeState.errors.code}>
          <Input
            id="code"
            name="code"
            type="text"
            dir="ltr"
            className="text-start font-mono tracking-[0.08em]"
            placeholder="K7M4-Q2XP"
            autoCapitalize="characters"
            maxLength={9}
            error={!!codeState.errors.code}
            required
          />
        </Field>
        {codeState.formError ? <Callout variant="error">{codeState.formError}</Callout> : null}
        <SubmitButton label="כניסה" />
      </form>

      <button type="button" onClick={() => setOtpMode(true)} className="text-[14px] text-text-2 hover:underline">
        אין לכם את הקוד? קבלו קוד למייל
      </button>
    </div>
  );
}
