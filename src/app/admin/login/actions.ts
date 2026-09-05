"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminAuthClient } from "../../../lib/supabase-admin-auth-client";

// ADMIN_UX.md §8: "Supabase Auth, email + password with 'forgot password'
// via magic link. MFA (TOTP) is mandatory." This action only does step one
// (password sign-in); the resulting session is aal1 until either MFA is
// enrolled (no factor yet) or the TOTP code is verified (factor exists) —
// both handled by /admin/mfa/enroll, which this redirects to whenever the
// session isn't already aal2.
export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/admin/login?error=missing");
  }

  const supabase = await createSupabaseAdminAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    redirect("/admin/login?error=invalid");
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === "aal2") {
    redirect("/admin/candidates");
  }
  redirect("/admin/mfa/enroll");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseAdminAuthClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/admin/login?error=missing");
  const supabase = await createSupabaseAdminAuthClient();
  await supabase.auth.resetPasswordForEmail(email);
  // Always the same message whether or not the email exists (no
  // account-enumeration signal).
  redirect("/admin/login?notice=reset_sent");
}
