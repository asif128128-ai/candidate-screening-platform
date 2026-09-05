// TODO(admin-ui engineer): job creation form (ADMIN_UX.md §5): title/slug,
// markdown description, כרטיס תנאים fields, 3 editable confirmation
// sentences, assessment config selector, response window, closure-email
// toggle, active toggle.
export default function AdminJobNewPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">משרה חדשה</h1>
      <p className="mt-2 text-neutral-500">
        טופס יצירת משרה ייבנה כאן — ראו ADMIN_UX.md §5.
      </p>
    </main>
  );
}
