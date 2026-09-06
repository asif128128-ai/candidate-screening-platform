import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { guardApplicationStep, stepPath } from "@/lib/application-guard";
import { AssessmentRunner } from "./runner";

// ARCHITECTURE.md §5.2 / CANDIDATE_FLOW.md §5: the assessment runner.
// Session-specific and cookie-dependent (like every other /apply/* page),
// so it must render dynamically per request, not be statically optimized.
export const dynamic = "force-dynamic";

export default async function AssessmentRunnerPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const guard = await guardApplicationStep(applicationId, "assessment");

  if (guard.kind === "already_past") {
    return (
      <CandidateShell width="reading" stepper={{ current: 4 }}>
        <Card className="mx-auto max-w-[480px] text-center">
          <h1 className="h1">המבחן</h1>
          <p className="mt-2 text-[16px] leading-[26px] text-text-2">
            כבר עברת את השלב הזה. אפשר להמשיך מהנקודה שבה עצרתם.
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

  return <AssessmentRunner applicationId={applicationId} />;
}
