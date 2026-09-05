"use server";

import { privacyRequestSchema } from "@/lib/validation";
import { zodErrorsToRecord, type FieldErrors } from "@/lib/form-state";
import { normalizeEmail } from "@/lib/normalize";
import { withSystem } from "@/db/postgres";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createPrivacyRequest } from "@/db/queries/application-flow";

// CANDIDATE_FLOW.md §7 / DATA_MODEL.md §3.20: access/correction/deletion
// request queue. Rate-limited like the other public forms; the spec also
// calls for "email-verified with a one-click link" for the DB row itself —
// that verification-link email loop is not built here (it would need a
// dedicated token table beyond `privacy_requests`'s current columns and a
// verify route); the row is created directly and reviewed by an admin
// per DATA_MODEL.md §3.20's "created either by an admin ... or by the
// candidate". Documented in IMPLEMENTATION_NOTES.md "Privacy request
// email verification — not built".

export interface PrivacyRequestState {
  errors: FieldErrors;
  formError: string | null;
  submitted: boolean;
}

// initialPrivacyRequestState lives in privacy-request-form.tsx — see
// jobs/[slug]/apply/actions.ts's note on why a "use server" file can't
// export a plain constant.

export async function submitPrivacyRequestAction(
  _prevState: PrivacyRequestState,
  formData: FormData,
): Promise<PrivacyRequestState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = privacyRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: zodErrorsToRecord(parsed.error), formError: null, submitted: false };
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email.ok) {
    return { errors: { email: email.error }, formError: null, submitted: false };
  }

  const rateLimitOk = await withSystem(async (tx) => {
    const { allowed } = await consumeRateLimit(tx, `privacy_request:${email.value}`, 3, 3600);
    return allowed;
  });
  if (!rateLimitOk) {
    return { errors: {}, formError: "יותר מדי בקשות, נסו שוב מאוחר יותר", submitted: false };
  }

  await createPrivacyRequest(
    email.value,
    parsed.data.kind as "access" | "delete" | "correct",
    parsed.data.note,
  );

  return { errors: {}, formError: null, submitted: true };
}
