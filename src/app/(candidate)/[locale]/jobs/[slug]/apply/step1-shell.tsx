"use client";

import { useState } from "react";
import { CandidateShell } from "@/components/candidate-shell";
import { PersonalDetailsForm } from "./personal-details-form";

// FINTECH_REDESIGN_PLAN.md §R2.2 step 1 item 7(a)/(c): the success panel
// used to render its own <Stepper> inside the card (a second stepper next
// to the header's) and its own H1/eyebrow lived on the page, above the
// card, even after the form was replaced by the success state — three
// different "how far am I" signals on screen at once. The fix needs the
// header's stepper to react to the form's outcome (`currentAlsoDone`) and
// the page-level H1/eyebrow to disappear once the success card renders its
// own heading — both need client state shared between the header and the
// form, hence this thin client wrapper around the (still server-fetched)
// job data.
export function ApplyStep1Shell({
  jobSlug,
  jobTitle,
  prefillEmail,
}: {
  jobSlug: string;
  jobTitle: string;
  prefillEmail?: string;
}) {
  const [succeeded, setSucceeded] = useState(false);

  return (
    <CandidateShell width="form" stepper={{ current: 1, currentAlsoDone: succeeded }}>
      {!succeeded ? (
        <>
          <p className="eyebrow truncate">{jobTitle}</p>
          <h1 className="h1 mt-1">פרטים אישיים</h1>
          <p className="mt-1 text-[13px] font-semibold leading-5 text-text-3">
            כ-3 דקות · נשמר אוטומטית בדפדפן
          </p>
        </>
      ) : null}
      <div className={succeeded ? undefined : "mt-8"}>
        <PersonalDetailsForm jobSlug={jobSlug} prefillEmail={prefillEmail} onOutcomeChange={setSucceeded} />
      </div>
    </CandidateShell>
  );
}
