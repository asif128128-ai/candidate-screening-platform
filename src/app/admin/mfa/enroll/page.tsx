// TODO(admin-ui engineer): mandatory TOTP enrollment (ADMIN_UX.md §8). A
// user without an enrolled factor is routed here by middleware and cannot
// reach any data page until enrollment completes.
export default function AdminMfaEnrollPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">הפעלת אימות דו-שלבי</h1>
      <p className="mt-2 text-neutral-500">
        הרשמה ל-TOTP תיבנה כאן — ראו ADMIN_UX.md §8.
      </p>
    </main>
  );
}
