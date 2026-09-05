// TODO(candidate-flow engineer): /privacy (CANDIDATE_FLOW.md §7). Renders
// the privacy_v1 notice text verbatim and a request form (access /
// correction / deletion) that inserts a privacy_requests row, rate-limited
// and email-verified with a one-click link per DATA_MODEL.md §3.20.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">מדיניות פרטיות</h1>
      <p className="mt-2 text-neutral-500">
        נוסח מדיניות הפרטיות וטופס הבקשה ייבנו כאן — ראו CANDIDATE_FLOW.md §7.
      </p>
    </main>
  );
}
