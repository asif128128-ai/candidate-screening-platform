import { signInAction, requestPasswordResetAction } from "./actions";

// ADMIN_UX.md §8 / ARCHITECTURE.md §6: Supabase Auth email+password login.
// On success the session is aal1 until MFA is verified; signInAction
// redirects to /admin/mfa/enroll (or straight to /admin/candidates if the
// session already reached aal2). This page itself never touches the
// database or checks the admin_users allowlist — that happens once inside
// src/app/admin/(protected)/layout.tsx, after a real data page is
// requested, exactly per ADMIN_UX.md §8's order of checks.
const ERROR_MESSAGES: Record<string, string> = {
  invalid: "אימייל או סיסמה שגויים.",
  missing: "יש למלא אימייל וסיסמה.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; notice?: string }>;
}) {
  const { error, reason, notice } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8" dir="rtl">
      <h1 className="text-xl font-semibold text-neutral-900">כניסת מנהלים</h1>
      <p className="mt-1 text-sm text-neutral-500">מערכת ניהול גיוס סטודנטים</p>

      {reason === "denied" && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          אין לך הרשאה למערכת זו.
        </p>
      )}
      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {ERROR_MESSAGES[error]}
        </p>
      )}
      {notice === "reset_sent" && (
        <p className="mt-4 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.
        </p>
      )}

      <form action={signInAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          אימייל
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            dir="ltr"
            className="ltr-inline rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          סיסמה
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            dir="ltr"
            className="ltr-inline rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          התחברות
        </button>
      </form>

      <form action={requestPasswordResetAction} className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
        <input
          type="email"
          name="email"
          placeholder="אימייל לאיפוס סיסמה"
          dir="ltr"
          className="ltr-inline flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs"
        />
        <button type="submit" className="shrink-0 underline hover:text-neutral-900">
          שכחתי סיסמה
        </button>
      </form>
    </main>
  );
}
