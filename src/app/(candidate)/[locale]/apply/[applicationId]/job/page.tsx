// TODO(candidate-flow engineer): step 2 — על התפקיד (CANDIDATE_FLOW.md §3).
// Render job.description_html + כרטיס תנאים + the 3 confirmations from
// jobs.confirmations_he; `confirmJobUnderstanding` action writes
// job_confirmed_at. Must validate the cookie's application_id matches the
// URL (mismatch -> 404) and enforce step ordering (§1).
export default async function ApplyStep2Page({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">על התפקיד</h1>
      <p className="mt-2 text-neutral-500">
        תיאור התפקיד וכרטיס התנאים ייבנו כאן — ראו CANDIDATE_FLOW.md §3.
        (application: {applicationId})
      </p>
    </main>
  );
}
