// TODO(assessment-engine engineer): the runner page (CANDIDATE_FLOW.md §5,
// ARCHITECTURE.md §5.2). This mounts a client component that talks to
// GET /api/assessment/current and POST /api/assessment/answer, renders each
// item kind (single/multi choice, numeric, short_text, ordering,
// investigation with artifact tabs), drives the countdown timer from
// deadline_at/server_now, buffers + flushes integrity_events, and requests
// fullscreen on mount. Pure scoring/generation logic lives in
// src/assessment/*.ts (generator.ts, scoring.ts, integrity.ts, timing.ts) —
// build and unit-test those first, per DESIGN_SUMMARY.md §8 milestone 2.
export default async function AssessmentRunnerPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">המבחן</h1>
      <p className="mt-2 text-neutral-500">
        רכיב הרצת המבחן ייבנה כאן — ראו ASSESSMENT_DESIGN.md ו-
        ARCHITECTURE.md §5.2. (application: {applicationId})
      </p>
    </main>
  );
}
