// TODO(candidate-flow engineer): step 1 — פרטים אישיים (CANDIDATE_FLOW.md
// §2). Form + `submitPersonalDetails` server action: zod validation,
// E.164/lowercase normalization, async CV upload via cv_upsert(), duplicate
// handling (§2.2), sets the app_session cookie, shows the resume code
// (§2.4), redirects to /apply/{application_id}/job.
export default async function ApplyStep1Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">הגשת מועמדות — {slug}</h1>
      <p className="mt-2 text-neutral-500">
        טופס פרטים אישיים ייבנה כאן — ראו CANDIDATE_FLOW.md §2.
      </p>
    </main>
  );
}
