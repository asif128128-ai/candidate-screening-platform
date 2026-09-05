import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { getJobBySlug } from "@/db/queries/jobs";
import { formatNumericHe } from "@/lib/format";

// CANDIDATE_FLOW.md §1.1 / DECISIONS_LOG.md #1: the terms card, the
// tech-ops/support honesty line, and the process outline render ABOVE any
// button — a candidate who self-selects out on rate, contractor status,
// location, or the computer requirement does so having given us nothing.
export default async function JobLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);

  if (!job) {
    return (
      <main className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">המשרה אינה פתוחה כרגע</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{job.title_he}</h1>
      <p className="mt-2 text-neutral-600">{job.summary_he}</p>

      <section
        className="mt-6 rounded-lg border-2 border-neutral-900 p-5"
        aria-label="כרטיס תנאים"
        data-testid="terms-card"
      >
        <h2 className="font-semibold">כרטיס תנאים</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            תעריף: <Term>{`${formatNumericHe(job.hourly_rate_ils)} ₪ לשעה`}</Term>
          </li>
          <li>
            היקף: <Term>{`כ-${formatNumericHe(job.hours_per_week)} שעות שבועיות`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.days_per_week)} ימים בשבוע`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.hours_per_day)} שעות ביום`}</Term>
          </li>
          <li>
            מיקום: {job.location_he}
            {job.hybrid_he ? ` · ${job.hybrid_he}` : ""}
          </li>
          <li>סוג התקשרות: {job.engagement_type_he}</li>
          <li>התחלה: {job.start_he}</li>
        </ul>
      </section>

      <p className="mt-6 text-sm leading-relaxed" data-testid="tech-ops-line">
        כ-50% פיתוח, כ-50% תפעול טכנולוגי, כולל חלק של תמיכה טכנית פנימית.
      </p>

      <section className="mt-6 rounded-md bg-neutral-50 p-4 text-sm leading-relaxed" data-testid="process-outline">
        <h2 className="font-semibold">איך התהליך עובד</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>טופס קצר — כ-3 דקות</li>
          <li>תיאור התפקיד ואישור התנאים — כ-2 דקות</li>
          <li>
            <strong>מבחן מקוון — כ-30 דקות, במחשב</strong> (לא בטלפון)
          </li>
        </ol>
        <p className="mt-2">
          כדאי לעבור את כל התהליך ברצף אחד מהמחשב — כ-35 דקות. אם בכל זאת תצטרכו לעצור, תקבלו קוד
          חזרה שמאפשר להמשיך מאותה נקודה.
        </p>
      </section>

      <Link
        href={`/jobs/${slug}/apply`}
        className="mt-8 block rounded-md bg-neutral-900 py-3 text-center font-medium text-white"
        data-testid="cta-apply"
      >
        להגשת מועמדות
      </Link>

      <p className="mt-4 text-center text-sm">
        <Link href="/privacy" className="underline">מדיניות הפרטיות</Link>
      </p>
    </main>
  );
}
