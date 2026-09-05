// TODO(admin-ui engineer): job edit form (ADMIN_UX.md §5), same fields as
// /admin/jobs/new plus a preview button (?preview=1) and delete-only-if-
// zero-applications guard.
export default async function AdminJobEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">עריכת משרה</h1>
      <p className="mt-2 text-neutral-500">
        טופס עריכת משרה ייבנה כאן — ראו ADMIN_UX.md §5. (job: {id})
      </p>
    </main>
  );
}
