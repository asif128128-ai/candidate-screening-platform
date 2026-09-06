import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TermsCard } from "@/components/ui/terms-card";
import { buttonClasses } from "@/components/ui/button";
import { getJobBySlug } from "@/db/queries/jobs";

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
      <CandidateShell width="reading">
        <h1 className="text-center text-[28px] font-bold leading-9 text-ink-900">המשרה אינה פתוחה כרגע</h1>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell width="reading">
      <h1 className="text-[28px] font-bold leading-9 text-ink-900 min-[480px]:text-[24px] min-[480px]:leading-8">
        {job.title_he}
      </h1>
      <p className="mt-2 text-[18px] leading-7 text-text-2">{job.summary_he}</p>

      <div className="mt-6">
        <TermsCard job={job} />
      </div>

      <p className="mt-6 text-[16px] leading-[26px] text-text" data-testid="tech-ops-line">
        התפקיד הוא כ-50% פיתוח וכ-50% תפעול טכנולוגי, כולל חלק של תמיכה טכנית פנימית — אנחנו אומרים
        את זה מראש.
      </p>

      <Card className="mt-6" data-testid="process-outline">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">איך התהליך עובד</h2>
        <ol className="mt-4 space-y-3">
          <li className="rtl-row items-start gap-3">
            <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-semibold text-ink-900">
              1
            </span>
            <span className="rtl-row flex-1 flex-wrap items-center gap-2 text-[16px] leading-[26px] text-text">
              טופס קצר <Chip>כ-3 דקות</Chip>
            </span>
          </li>
          <li className="rtl-row items-start gap-3">
            <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-semibold text-ink-900">
              2
            </span>
            <span className="rtl-row flex-1 flex-wrap items-center gap-2 text-[16px] leading-[26px] text-text">
              תיאור התפקיד ואישור התנאים <Chip>כ-2 דקות</Chip>
            </span>
          </li>
          <li className="rtl-row items-start gap-3">
            <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-semibold text-ink-900">
              3
            </span>
            <span className="rtl-row flex-1 flex-wrap items-center gap-2 text-[16px] leading-[26px] text-text">
              <strong className="font-semibold">מבחן מקוון, במחשב (לא בטלפון)</strong>{" "}
              <Chip>כ-20 דקות</Chip>
            </span>
          </li>
        </ol>
        <p className="mt-4 text-[14px] leading-[22px] text-text-2">
          כדאי לעבור את כל התהליך ברצף אחד מהמחשב — כ-25 דקות. אם בכל זאת תצטרכו לעצור, תקבלו קוד
          חזרה שמאפשר להמשיך מאותה נקודה.
        </p>
      </Card>

      <Link href={`/jobs/${slug}/apply`} className={`mt-8 ${buttonClasses()}`} data-testid="cta-apply">
        להגשת מועמדות
      </Link>

      <p className="mt-4 text-center text-[13px] leading-5 text-text-3">
        <Link href="/privacy" className="hover:underline">
          מדיניות הפרטיות
        </Link>
      </p>
    </CandidateShell>
  );
}
