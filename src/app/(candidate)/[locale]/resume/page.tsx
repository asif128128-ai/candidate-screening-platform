import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { ResumeForm } from "./resume-form";

// CANDIDATE_FLOW.md §2.4 — /resume: re-entry that does not depend on email.
export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <CandidateShell width="form">
      <h1 className="text-[28px] font-bold leading-9 text-ink-900 min-[480px]:text-[24px] min-[480px]:leading-8">
        חזרה לתהליך
      </h1>
      <p className="mt-2 text-[16px] leading-[26px] text-text-2">הזינו אימייל וקוד חזרה כדי להמשיך מאותה נקודה.</p>
      <Card className="mt-6">
        <ResumeForm prefillEmail={email} />
      </Card>
    </CandidateShell>
  );
}
