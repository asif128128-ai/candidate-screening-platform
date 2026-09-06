import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { TermsCard } from "@/components/ui/terms-card";
import { buttonClasses } from "@/components/ui/button";
import { guardApplicationStep, stepPath } from "@/lib/application-guard";
import { getJobBySlug } from "@/db/queries/jobs";
import { ConfirmationsForm } from "./confirmations-form";

// CANDIDATE_FLOW.md §3 — step 2: על התפקיד.
export default async function ApplyStep2Page({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const guard = await guardApplicationStep(applicationId, "job");
  const job = await getJobBySlug(guard.state.jobSlug);

  if (!job) {
    return (
      <CandidateShell width="reading">
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

  if (guard.kind === "already_past") {
    return (
      <CandidateShell width="reading" stepper={{ current: 2 }}>
        <Card className="mx-auto max-w-[480px] text-center">
          <h1 className="h1">על התפקיד</h1>
          <p className="mt-2 text-[16px] leading-[26px] text-text-2">
            כבר אישרת את השלב הזה. אפשר להמשיך מהנקודה שבה עצרתם.
          </p>
          <Link
            href={stepPath(applicationId, guard.state.currentStep)}
            className={`mt-4 ${buttonClasses({ fullWidth: false })}`}
          >
            המשך
          </Link>
        </Card>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell width="reading" stepper={{ current: 2 }}>
      <h1 className="h1">{job.title_he}</h1>

      {/* description_html is rendered server-side at job-save time (no runtime markdown lib, ARCHITECTURE.md §7). */}
      <Card className="mt-6">
        <div
          className="max-w-none text-[16px] leading-[26px] text-text [&_h2]:mt-6 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-ink-900 [&_h3]:mt-4 [&_h3]:text-[16px] [&_h3]:font-semibold [&_li]:mt-2 [&_ol]:mt-2 [&_ol]:list-inside [&_ol]:list-decimal [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-inside [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: job.description_html }}
        />
      </Card>

      <div className="mt-6">
        <TermsCard job={job} />
      </div>

      <div className="mt-6">
        <ConfirmationsForm applicationId={applicationId} showRishonNote={!guard.state.canWorkRishon} />
      </div>
    </CandidateShell>
  );
}
