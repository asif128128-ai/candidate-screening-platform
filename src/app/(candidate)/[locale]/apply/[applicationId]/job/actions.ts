"use server";

import { jobConfirmationSchema } from "@/lib/validation";
import { zodErrorsToRecord, type FieldErrors } from "@/lib/form-state";
import { confirmJobUnderstanding } from "@/db/queries/application-flow";
import { redirect } from "@/i18n/navigation";
import { checkCandidateCookie } from "@/lib/candidate-session";

export interface JobConfirmationState {
  errors: FieldErrors;
}

// initialJobConfirmationState lives in confirmations-form.tsx — see
// jobs/[slug]/apply/actions.ts's note on why a "use server" file can't
// export a plain constant.

export async function confirmJobUnderstandingAction(
  applicationId: string,
  _prevState: JobConfirmationState,
  formData: FormData,
): Promise<JobConfirmationState> {
  const cookieCheck = await checkCandidateCookie(applicationId);
  if (cookieCheck.kind !== "ok") {
    return { errors: { form: "פג תוקף החיבור, יש להתחבר מחדש דרך /resume" } };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = jobConfirmationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error) };
  }

  await confirmJobUnderstanding(applicationId);
  return redirect({ href: `/apply/${applicationId}/briefing`, locale: "he" });
}
