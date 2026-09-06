import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TermsCard } from "@/components/ui/terms-card";
import { buttonClasses } from "@/components/ui/button";
import { Term } from "@/components/term";
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

  return (
    <CandidateShell width="reading">
      <h1 className="h1">{job.title_he}</h1>
      <p className="mt-2 text-[18px] leading-7 text-text-2">{job.summary_he}</p>

      <div className="mt-6">
        <TermsCard job={job} />
      </div>

      <Card className="mt-6">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">מה התפקיד באמת</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 min-[480px]:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold leading-5 text-brand-700">פיתוח · כ-50%</p>
            <p className="mt-1 text-[15px] leading-[24px] text-text-2">
              כלים פנימיים, אוטומציות, אינטגרציות ועבודה מול <Term>APIs</Term>.
            </p>
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-5 text-brand-700">תפעול טכנולוגי · כ-50%</p>
            <p className="mt-1 text-[15px] leading-[24px] text-text-2">
              תשתיות ו-<Term>Cloud</Term>, הרשאות ומערכות <Term>SaaS</Term>, נתונים, לוגים ותקלות.
            </p>
          </div>
        </div>
        <p className="mt-5 text-[16px] leading-[26px] text-text" data-testid="tech-ops-line">
          חלק מהתפעול הוא תמיכה טכנית פנימית לעובדים — זה חלק אמיתי מהתפקיד, אבל זו לא משרת{" "}
          <Term>Help Desk</Term>. מי שרואה את התקלות מקרוב הוא מי שיודע מה כדאי לאוטמט ולייעל, וזו
          בדיוק ההזדמנות: להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר —{" "}
          <strong className="font-semibold text-ink-900">ואתם תהיו חלק מרכזי בזה.</strong>
        </p>
      </Card>

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
