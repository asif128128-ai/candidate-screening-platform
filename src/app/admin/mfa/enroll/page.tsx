import { redirect } from "next/navigation";
import { createSupabaseAdminAuthClient } from "../../../../lib/supabase-admin-auth-client";
import { verifyMfaAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "הקוד שגוי או פג תוקף. נסה/נסי שוב.",
  missing: "יש להזין קוד בן 6 ספרות.",
};

// ADMIN_UX.md §8: "MFA (TOTP) enrollment is mandatory ... a user without an
// enrolled factor is routed to /admin/mfa/enroll and cannot reach any data
// page until done." This page serves two cases with one URL:
//   (a) first login, no TOTP factor yet -> show a fresh QR code to scan;
//   (b) a later login, factor already verified, session just needs
//       stepping up to aal2 -> show a plain 6-digit code field.
//
// Calling supabase.auth.mfa.enroll()/.unenroll() during render (rather than
// only from a Server Action) is a deliberate, narrow exception: enrolling a
// factor doesn't change the session's aal or trigger a cookie-relevant auth
// event (only a *verified* challenge does), so there's nothing here that
// needs to write a cookie — the one thing a Server Component genuinely
// cannot do. A page refresh mid-enrollment discards the previous unverified
// factor and shows a fresh QR, which is simple and correct for a rare
// admin-bootstrap flow, at the cost of not surviving a refresh mid-scan.
export default async function AdminMfaEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createSupabaseAdminAuthClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/admin/login");
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === "aal2") {
    redirect("/admin/candidates");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");

  if (verifiedTotp) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8" dir="rtl">
        <h1 className="text-xl font-semibold text-neutral-900">אימות דו-שלבי</h1>
        <p className="mt-2 text-sm text-neutral-500">
          הזן/י את הקוד בן 6 הספרות מאפליקציית האימות שלך.
        </p>
        {error && ERROR_MESSAGES[error] && (
          <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            {ERROR_MESSAGES[error]}
          </p>
        )}
        <form action={verifyMfaAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="factorId" value={verifiedTotp.id} />
          <input
            type="text"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            dir="ltr"
            className="ltr-inline rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            אישור
          </button>
        </form>
      </main>
    );
  }

  // No verified factor yet: discard any stale unverified attempt and enroll
  // a fresh one so the QR shown always matches the factorId this render's
  // form will submit.
  for (const stale of factorsData?.totp?.filter((f) => f.status === "unverified") ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }
  const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `admin-${Date.now()}`,
  });

  if (enrollError || !enrollData) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8" dir="rtl">
        <h1 className="text-xl font-semibold text-neutral-900">הפעלת אימות דו-שלבי</h1>
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          לא ניתן להתחיל הרשמה כרגע. נסה/נסי שוב מאוחר יותר, או פנה/י למפתח/ת.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8" dir="rtl">
      <h1 className="text-xl font-semibold text-neutral-900">הפעלת אימות דו-שלבי</h1>
      <p className="mt-2 text-sm text-neutral-500">
        אימות דו-שלבי (TOTP) הוא חובה במערכת זו. סרוק/סרקי את הקוד באפליקציית אימות
        (כגון Google Authenticator או Authy), ולאחר מכן הזן/י את הקוד שמופיע בה.
      </p>
      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {ERROR_MESSAGES[error]}
        </p>
      )}
      {enrollData.totp?.qr_code && (
        // eslint-disable-next-line @next/next/no-img-element -- data: URI SVG from Supabase, not an optimizable asset
        <img
          src={enrollData.totp.qr_code}
          alt="קוד QR להרשמה לאימות דו-שלבי"
          className="mx-auto mt-4 h-48 w-48"
        />
      )}
      <p className="mt-2 text-center text-xs text-neutral-500">
        לא ניתן לסרוק? הזן/י ידנית: <span dir="ltr" className="ltr-inline font-mono">{enrollData.totp?.secret}</span>
      </p>
      <form action={verifyMfaAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="factorId" value={enrollData.id} />
        <input
          type="text"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          dir="ltr"
          className="ltr-inline rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          אישור והפעלה
        </button>
      </form>
    </main>
  );
}
