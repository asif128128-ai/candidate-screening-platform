"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { confirmJobUnderstandingAction, type JobConfirmationState } from "./actions";

const initialJobConfirmationState: JobConfirmationState = { errors: {} };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-md bg-neutral-900 py-3 font-medium text-white disabled:opacity-50"
      data-testid="job-confirm-submit"
    >
      הבנתי, ממשיכים
    </button>
  );
}

export function ConfirmationsForm({
  applicationId,
  showRishonNote,
}: {
  applicationId: string;
  showRishonNote: boolean;
}) {
  const boundAction = confirmJobUnderstandingAction.bind(null, applicationId);
  const [state, formAction] = useActionState<JobConfirmationState, FormData>(
    boundAction,
    initialJobConfirmationState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-3" data-testid="job-confirmations-form">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm1" required className="mt-1" data-testid="confirm1" />
        <span>הבנתי שהתפקיד משלב פיתוח תוכנה עם תפעול טכנולוגי, כולל חלק של תחזוקה ותמיכה טכנית פנימית.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm2" required className="mt-1" data-testid="confirm2" />
        <span>
          הבנתי את התנאים: 85 ₪ לשעה, כ-18 שעות שבועיות (כ-3 ימים × 6 שעות), התקשרות כנותן/ת שירותים
          עצמאי/ת, תחילת עבודה מיידית.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm3" required className="mt-1" data-testid="confirm3" />
        <span>
          הבנתי שהעבודה דורשת יכולת להגיע פיזית לאזור ראשון לציון (היברידי אפשרי, לא מרחוק בלבד).
          {showRishonNote ? (
            <span className="mt-1 block text-amber-700">
              ציינת שזה לא מתאים לך כרגע. זה לא פוסל את המועמדות, אבל ייכלל בשיקולים — אפשר להמשיך.
            </span>
          ) : null}
        </span>
      </label>
      {state.errors.form ? <p className="text-sm text-red-600">{state.errors.form}</p> : null}
      <SubmitButton />
    </form>
  );
}
