// TODO(candidate-flow engineer): job landing page — CANDIDATE_FLOW.md §1.1.
// Must render the terms card (rate/hours/contractor/location), the
// tech-ops/support honesty line, and the process outline BEFORE any button,
// fetched from `jobs` where slug = params.slug and is_active. Inactive job
// -> friendly "המשרה אינה פתוחה כרגע" message (unless ?preview=1 as admin).
export default async function JobLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">משרה: {slug}</h1>
      <p className="mt-2 text-neutral-500">
        עמוד הנחיתה של המשרה ייבנה כאן (כרטיס תנאים, שורת התפעול הטכנולוגי,
        תיאור התהליך) — ראו CANDIDATE_FLOW.md §1.1.
      </p>
    </main>
  );
}
