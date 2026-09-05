// TODO(candidate-flow engineer): step 3 — לפני המבחן (CANDIDATE_FLOW.md §4).
// Rules copy, integrity disclosure + consent (ANTI_CHEATING.md §2), device
// check (viewport >= 900px, JS, cookie, clock skew, Fullscreen API).
// "מתחילים" button calls the `startAssessment` server action (owned by the
// assessment-engine engineer — ARCHITECTURE.md §5.1 step 4) which creates
// the assessment_sessions row and materializes all 27 items.
export default async function BriefingPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">לפני המבחן</h1>
      <p className="mt-2 text-neutral-500">
        חוקי המבחן, גילוי נאות ובדיקת מכשיר ייבנו כאן — ראו CANDIDATE_FLOW.md
        §4. (application: {applicationId})
      </p>
    </main>
  );
}
