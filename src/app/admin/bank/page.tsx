// TODO(admin-ui engineer / assessment-engine engineer): question bank
// analytics, read-only (ADMIN_UX.md §6). Per-template accuracy, median time,
// skip/expiry rates, scenario leakage drift; "צפה בדוגמה" renders a fresh
// random instance via the generator.
export default function AdminBankPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">בנק השאלות</h1>
      <p className="mt-2 text-neutral-500">
        אנליטיקת בנק השאלות תיבנה כאן — ראו ADMIN_UX.md §6.
      </p>
    </main>
  );
}
