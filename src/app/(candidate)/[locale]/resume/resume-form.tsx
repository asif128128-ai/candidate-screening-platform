"use client";

import { useActionState, useState } from "react";
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
  const [otpRequestState, otpRequestFormAction] = useActionState(requestOtpAction, initialOtpRequestState);
  const [otpVerifyState, otpVerifyFormAction] = useActionState(verifyOtpAction, initialOtpVerifyState);

  if (otpMode) {
    return (
      <div className="space-y-6" data-testid="otp-panel">
        <form action={otpRequestFormAction} className="space-y-4">
          <Field label="אימייל" htmlFor="otp-email" error={otpRequestState.errors.email}>
            <Input
              id="otp-email"
              name="email"
              type="email"
              dir="ltr"
              className="text-start"
              defaultValue={prefillEmail}
              error={!!otpRequestState.errors.email}
              required
            />
          </Field>
          {otpRequestState.formError ? <Callout variant="error">{otpRequestState.formError}</Callout> : null}
          {otpRequestState.sent ? (
            <Callout variant="success">אם קיים חשבון עם האימייל הזה, נשלח אליו קוד.</Callout>
          ) : null}
          <SubmitButton label="שליחת קוד למייל" />
        </form>

        <form action={otpVerifyFormAction} className="space-y-4 border-t border-line pt-6">
          <Field label="אימייל" htmlFor="otp-email-2">
            <Input id="otp-email-2" name="email" type="email" dir="ltr" className="text-start" defaultValue={prefillEmail} required />
          </Field>
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
        <Field
          label={
            <>
              קוד החזרה (<Term>K7M4-Q2XP</Term>)
            </>
          }
          htmlFor="code"
          error={codeState.errors.code}
        >
          <Input id="code" name="code" type="text" dir="ltr" className="text-start" error={!!codeState.errors.code} required />
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
