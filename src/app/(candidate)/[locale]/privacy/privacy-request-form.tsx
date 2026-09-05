"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, Input } from "@/components/ui/field";
import { submitPrivacyRequestAction, type PrivacyRequestState } from "./actions";

const initialPrivacyRequestState: PrivacyRequestState = {
  errors: {},
  formError: null,
  submitted: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending}>
      {pending ? "שולח…" : "שליחת בקשה"}
    </Button>
  );
}

const REQUEST_KINDS = [
  { value: "access", label: "עיון בפרטים" },
  { value: "correct", label: "תיקון פרטים" },
  { value: "delete", label: "מחיקת פרטים" },
] as const;

export function PrivacyRequestForm() {
  const [state, formAction] = useActionState(submitPrivacyRequestAction, initialPrivacyRequestState);

  if (state.submitted) {
    return (
      <Callout variant="success" data-testid="privacy-request-submitted">
        הבקשה התקבלה. נטפל בה תוך 30 יום.
      </Callout>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <Field label="אימייל" htmlFor="email" error={state.errors.email}>
        <Input id="email" name="email" type="email" dir="ltr" className="text-start" error={!!state.errors.email} required />
      </Field>

      <fieldset>
        <legend className="text-[14px] font-medium leading-[22px] text-text-2">סוג הבקשה</legend>
        <div className="mt-2 space-y-2">
          {REQUEST_KINDS.map((kind) => (
            <label key={kind.value} className="rtl-row items-center gap-2 text-[15px] leading-6 text-text">
              <input type="radio" name="kind" value={kind.value} required className="h-4 w-4 accent-brand-600" />
              {kind.label}
            </label>
          ))}
        </div>
        {state.errors.kind ? <p className="mt-1 text-[13px] leading-5 text-red-600">{state.errors.kind}</p> : null}
      </fieldset>

      <Field label="פרטים נוספים" htmlFor="note" optional>
        <textarea
          id="note"
          name="note"
          rows={4}
          className="w-full rounded-10 border border-line-strong bg-white px-[14px] py-3 text-base leading-6 text-text transition-[border-color,box-shadow] duration-150 focus:border-brand-600 focus:shadow-[0_0_0_3px_var(--brand-100)] focus:outline-none"
        />
      </Field>

      {state.formError ? <Callout variant="error">{state.formError}</Callout> : null}
      <SubmitButton />
    </form>
  );
}
