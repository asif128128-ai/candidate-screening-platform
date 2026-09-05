import { Link } from "@/i18n/navigation";
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
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">המבחן</h1>
        <p className="mt-2 text-neutral-600">כבר עברת את השלב הזה.</p>
        <Link
          href={stepPath(applicationId, guard.state.currentStep)}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          המשך
        </Link>
      </main>
    );
  }

  return <AssessmentRunner applicationId={applicationId} />;
}
