// TODO(admin-ui engineer): candidate list (ADMIN_UX.md §3). Server-rendered
// table over the `admin_application_rows` view, keyset pagination (50 rows),
// URL-encoded filter state, quick filters (מובילים / ממתינים לבדיקה / עבר
// מועד התשובה / ...), alert banners from `admin_alerts` at the top.
export default function AdminCandidatesPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">מועמדים</h1>
      <p className="mt-2 text-neutral-500">
        טבלת המועמדים תיבנה כאן — ראו ADMIN_UX.md §3.
      </p>
    </main>
  );
}
