import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { getJobBySlug } from "@/db/queries/jobs";
import { ApplyStep1Shell } from "./step1-shell";

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
        <Card className="mx-auto max-w-[480px] text-center">
          <h1 className="h1">המשרה אינה פתוחה כרגע</h1>
          <p className="mt-2 text-[16px] leading-[26px] text-text-2">
            ייתכן שהקישור ישן או שהמשרה כבר אוישה. אם הגעתם לכאן מהודעה שקיבלתם מאיתנו, כתבו לנו —
            הכתובת בעמוד מדיניות הפרטיות.
          </p>
          <Link href="/privacy" className={`mt-4 ${buttonClasses({ variant: "secondary", fullWidth: false })}`}>
            למדיניות הפרטיות
          </Link>
        </Card>
      </CandidateShell>
    );
  }

  return <ApplyStep1Shell jobSlug={slug} jobTitle={job.title_he} prefillEmail={email} />;
}
