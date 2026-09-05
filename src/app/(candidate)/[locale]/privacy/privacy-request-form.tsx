"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitPrivacyRequestAction, type PrivacyRequestState } from "./actions";

const initialPrivacyRequestState: PrivacyRequestState = {
  errors: {},
  formError: null,
  submitted: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 py-3 font-medium text-white disabled:opacity-50"
    >
      {pending ? "שולח…" : "שליחת בקשה"}
    </button>
  );
}

export function PrivacyRequestForm() {
  const [state, formAction] = useActionState(submitPrivacyRequestAction, initialPrivacyRequestState);

  if (state.submitted) {
    return (
      <p className="rounded-md bg-green-50 p-4 text-sm text-green-800" data-testid="privacy-request-submitted">
        הבקשה התקבלה. נטפל בה תוך 30 יום.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">אימייל</label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-start"
          required
        />
        {state.errors.email ? <p className="mt-1 text-sm text-red-600">{state.errors.email}</p> : null}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">סוג הבקשה</legend>
        <div className="mt-1 space-y-1">
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="access" required /> עיון בפרטים
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="correct" /> תיקון פרטים
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="delete" /> מחיקת פרטים
          </label>
        </div>
        {state.errors.kind ? <p className="mt-1 text-sm text-red-600">{state.errors.kind}</p> : null}
      </fieldset>

      <div>
        <label htmlFor="note" className="block text-sm font-medium">פרטים נוספים (לא חובה)</label>
        <textarea
          id="note"
          name="note"
          rows={4}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2"
        />
      </div>

      {state.formError ? <p className="text-sm text-red-600">{state.formError}</p> : null}
      <SubmitButton />
    </form>
  );
}
