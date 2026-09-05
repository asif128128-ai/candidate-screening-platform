"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminAuthClient } from "../../../../lib/supabase-admin-auth-client";

// ADMIN_UX.md §8: "MFA (TOTP) enrollment is mandatory on first login." This
// verifies the 6-digit code against the factor created by the page
// (page.tsx calls supabase.auth.mfa.enroll() during render — see its
// comment for why that's safe here) and, on success, the session reaches
// aal2 and every /admin/* data page becomes reachable.
export async function verifyMfaAction(formData: FormData): Promise<void> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!factorId || !code) {
    redirect(`/admin/mfa/enroll?error=missing`);
  }

  const supabase = await createSupabaseAdminAuthClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    redirect(`/admin/mfa/enroll?error=invalid_code`);
  }
  redirect("/admin/candidates");
}
