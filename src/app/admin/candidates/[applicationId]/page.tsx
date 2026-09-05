// TODO(admin-ui engineer): candidate detail (ADMIN_UX.md §4). Profile card
// + tabs (סיכום / תוצאות המבחן / אמינות המבחן / הערות / היסטוריה), CV via
// 60-second signed URL, stage changes, danger zone (reset/keep/delete).
export default async function AdminCandidateDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">כרטיס מועמד</h1>
      <p className="mt-2 text-neutral-500">
        פרופיל המועמד ולשוניות הפירוט ייבנו כאן — ראו ADMIN_UX.md §4.
        (application: {applicationId})
      </p>
    </main>
  );
}
