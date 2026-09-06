"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { confirmJobUnderstandingAction, type JobConfirmationState } from "./actions";

const initialJobConfirmationState: JobConfirmationState = { errors: {} };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} data-testid="job-confirm-submit">
      הבנתי, ממשיכים
    </Button>
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
    <Card>
      {/* FINTECH_REDESIGN_PLAN.md §R2.2 step 2 item 3: this is the action
          surface on the page (it stays raised), so it gets a real title and
          dividers between rows instead of reading as equal-weight to the
          two reading cards above it. */}
      <h2 className="text-[17px] font-semibold leading-6 text-ink-900">לפני שממשיכים, שלושה אישורים</h2>
      <form action={formAction} className="mt-4" data-testid="job-confirmations-form">
        <div className="divide-y divide-line">
          <div className="py-2">
            <Checkbox
              name="confirm1"
              required
              data-testid="confirm1"
              label="הבנתי שהתפקיד משלב פיתוח תוכנה עם תפעול טכנולוגי, כולל חלק של תחזוקה ותמיכה טכנית פנימית."
            />
          </div>
          <div className="py-2">
            <Checkbox
              name="confirm2"
              required
              data-testid="confirm2"
              label="הבנתי את התנאים: 85 ₪ לשעה, כ-18 שעות שבועיות (כ-3 ימים × 6 שעות), התקשרות כנותן/ת שירותים עצמאי/ת, תחילת עבודה מיידית."
            />
          </div>
          <div className="py-2">
            <Checkbox
              name="confirm3"
              required
              data-testid="confirm3"
              label="הבנתי שהעבודה דורשת יכולת להגיע פיזית לאזור ראשון לציון (היברידי אפשרי, לא מרחוק בלבד)."
            />
            {showRishonNote ? (
              <Callout variant="warning" className="mt-2">
                ציינת שזה לא מתאים לך כרגע. זה לא פוסל את המועמדות, אבל ייכלל בשיקולים — אפשר להמשיך.
              </Callout>
            ) : null}
          </div>
        </div>
        {state.errors.form ? <Callout variant="error" className="mt-4">{state.errors.form}</Callout> : null}
        <div className="mt-4">
          <SubmitButton />
        </div>
      </form>
    </Card>
  );
}
