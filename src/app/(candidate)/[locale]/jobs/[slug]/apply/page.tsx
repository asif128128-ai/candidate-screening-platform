import { CandidateShell } from "@/components/candidate-shell";
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
      <CandidateShell width="form">
        <h1 className="text-center text-[20px] font-semibold leading-7 text-ink-900">המשרה אינה פתוחה כרגע</h1>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell width="form" stepper={{ current: 1 }}>
      <h1 className="text-[28px] font-bold leading-9 text-ink-900 min-[480px]:text-[24px] min-[480px]:leading-8">
        פרטים אישיים
      </h1>
      <p className="mt-1 text-[13px] font-semibold leading-5 text-text-3">
        כ-3 דקות · נשמר אוטומטית בדפדפן — {job.title_he}
      </p>
      <div className="mt-6">
        <PersonalDetailsForm jobSlug={slug} prefillEmail={email} />
      </div>
    </CandidateShell>
  );
}
