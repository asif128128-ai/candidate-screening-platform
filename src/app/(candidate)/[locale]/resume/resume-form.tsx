"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Term } from "@/components/term";
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
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 py-3 font-medium text-white disabled:opacity-50"
    >
      {pending ? "בודק…" : label}
    </button>
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
        <form action={otpRequestFormAction} className="space-y-3">
          <div>
            <label htmlFor="otp-email" className="block text-sm font-medium">אימייל</label>
            <input
              id="otp-email"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={prefillEmail}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
              required
            />
            {otpRequestState.errors.email ? (
              <p className="mt-1 text-sm text-red-600">{otpRequestState.errors.email}</p>
            ) : null}
          </div>
          {otpRequestState.formError ? (
            <p className="text-sm text-red-600">{otpRequestState.formError}</p>
          ) : null}
          {otpRequestState.sent ? (
            <p className="text-sm text-green-700">אם קיים חשבון עם האימייל הזה, נשלח אליו קוד.</p>
          ) : null}
          <SubmitButton label="שליחת קוד למייל" />
        </form>

        <form action={otpVerifyFormAction} className="space-y-3">
          <div>
            <label htmlFor="otp-email-2" className="block text-sm font-medium">אימייל</label>
            <input
              id="otp-email-2"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={prefillEmail}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
              required
            />
          </div>
          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium">הקוד שקיבלת</label>
            <input
              id="otp-code"
              name="code"
              type="text"
              dir="ltr"
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
              required
            />
            {otpVerifyState.errors.code ? (
              <p className="mt-1 text-sm text-red-600">{otpVerifyState.errors.code}</p>
            ) : null}
          </div>
          {otpVerifyState.formError ? (
            <p className="text-sm text-red-600">{otpVerifyState.formError}</p>
          ) : null}
          <SubmitButton label="אימות קוד וכניסה" />
        </form>

        <button type="button" onClick={() => setOtpMode(false)} className="text-sm underline">
          חזרה להזנת קוד החזרה
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={codeFormAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">אימייל</label>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={prefillEmail}
            placeholder="name@example.com"
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
            required
          />
          {codeState.errors.email ? <p className="mt-1 text-sm text-red-600">{codeState.errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="code" className="block text-sm font-medium">
            קוד החזרה (<Term>K7M4-Q2XP</Term>)
          </label>
          <input
            id="code"
            name="code"
            type="text"
            dir="ltr"
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
            required
          />
          {codeState.errors.code ? <p className="mt-1 text-sm text-red-600">{codeState.errors.code}</p> : null}
        </div>
        {codeState.formError ? <p className="text-sm text-red-600">{codeState.formError}</p> : null}
        <SubmitButton label="כניסה" />
      </form>

      <button type="button" onClick={() => setOtpMode(true)} className="text-sm underline">
        אין לך את הקוד? שלחו לי קוד למייל
      </button>
    </div>
  );
}
