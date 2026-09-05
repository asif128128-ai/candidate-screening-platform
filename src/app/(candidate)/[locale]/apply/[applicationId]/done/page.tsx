// TODO(candidate-flow engineer): done page (CANDIDATE_FLOW.md §6). Shows
// the promised response date (jobs.response_window_days), a link to
// /privacy, and the "abandoned" variant copy if the session hit the 75-min
// wall clock. No score is ever shown to candidates.
export default async function DonePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">תודה!</h1>
      <p className="mt-2 text-neutral-500">
        עמוד הסיום ייבנה כאן — ראו CANDIDATE_FLOW.md §6. (application:{" "}
        {applicationId})
      </p>
    </main>
  );
}
