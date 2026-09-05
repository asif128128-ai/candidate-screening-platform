import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { guardApplicationStep, stepPath } from "@/lib/application-guard";
import { getJobBySlug } from "@/db/queries/jobs";
import { formatNumericHe } from "@/lib/format";
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
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">המשרה אינה זמינה</h1>
      </main>
    );
  }

  if (guard.kind === "already_past") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">על התפקיד</h1>
        <p className="mt-2 text-neutral-600">כבר אישרת את השלב הזה.</p>
        <Link
          href={stepPath(applicationId, guard.state.currentStep)}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          המשך
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">{job.title_he}</h1>
      {/* description_html is rendered server-side at job-save time (no runtime markdown lib, ARCHITECTURE.md §7). */}
      <div
        className="prose prose-neutral mt-4 max-w-none"
        dangerouslySetInnerHTML={{ __html: job.description_html }}
      />

      <section className="mt-6 rounded-lg border-2 border-neutral-900 p-5" data-testid="terms-card">
        <h2 className="font-semibold">כרטיס תנאים</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>תעריף: <Term>{`${formatNumericHe(job.hourly_rate_ils)} ₪ לשעה`}</Term></li>
          <li>
            היקף: <Term>{`כ-${formatNumericHe(job.hours_per_week)} שעות שבועיות`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.days_per_week)} ימים בשבוע`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.hours_per_day)} שעות ביום`}</Term>
          </li>
          <li>מיקום: {job.location_he}{job.hybrid_he ? ` · ${job.hybrid_he}` : ""}</li>
          <li>סוג התקשרות: {job.engagement_type_he}</li>
          <li>התחלה: {job.start_he}</li>
        </ul>
      </section>

      <ConfirmationsForm applicationId={applicationId} showRishonNote={!guard.state.canWorkRishon} />
    </main>
  );
}
