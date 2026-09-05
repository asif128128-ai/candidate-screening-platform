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
    <Button type="submit" pending={pending} data-testid="job-confirm-submit" className="mt-4">
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
      <form action={formAction} className="space-y-4" data-testid="job-confirmations-form">
        <Checkbox
          name="confirm1"
          required
          data-testid="confirm1"
          label="הבנתי שהתפקיד משלב פיתוח תוכנה עם תפעול טכנולוגי, כולל חלק של תחזוקה ותמיכה טכנית פנימית."
        />
        <Checkbox
          name="confirm2"
          required
          data-testid="confirm2"
          label="הבנתי את התנאים: 85 ₪ לשעה, כ-18 שעות שבועיות (כ-3 ימים × 6 שעות), התקשרות כנותן/ת שירותים עצמאי/ת, תחילת עבודה מיידית."
        />
        <div>
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
        {state.errors.form ? <Callout variant="error">{state.errors.form}</Callout> : null}
        <SubmitButton />
      </form>
    </Card>
  );
}
