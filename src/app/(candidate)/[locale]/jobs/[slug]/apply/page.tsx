import { getJobBySlug } from "@/db/queries/jobs";
import { PersonalDetailsForm } from "./personal-details-form";

// CANDIDATE_FLOW.md §2: step 1 — פרטים אישיים.
export default async function ApplyStep1Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { slug } = await params;
  const { email } = await searchParams;
  const job = await getJobBySlug(slug);

  if (!job) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">המשרה אינה פתוחה כרגע</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">הגשת מועמדות — {job.title_he}</h1>
      <div className="mt-6">
        <PersonalDetailsForm jobSlug={slug} prefillEmail={email} />
      </div>
    </main>
  );
}
