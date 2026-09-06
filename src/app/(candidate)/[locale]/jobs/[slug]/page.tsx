import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TermsCard } from "@/components/ui/terms-card";
import { buttonClasses, PAGE_CTA_WIDTH_CLASS } from "@/components/ui/button";
import { Term } from "@/components/term";
import { BRAND_NAME } from "@/lib/brand";
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
      {/* FINTECH_REDESIGN_PLAN.md §R2.2 landing item 2: an eyebrow row above
          the H1 turns the summary line into a hook instead of meta text
          floating with no separation from the heading. */}
      <p className="eyebrow tnum">{BRAND_NAME} · ראשון לציון · משרה חלקית</p>
      <h1 className="h1 mt-1">{job.title_he}</h1>
      <p className="mt-3 text-[18px] leading-7 text-text-2">{job.summary_he}</p>

      {/* §R2.3.3 rhythm: mt-8 from the H1 block to the first surface. */}
      <div className="mt-8">
        <TermsCard job={job} />
      </div>

      {/* §R2.3.3 "one raised surface per page": this and the process card
          below are reading content, not an action surface — flat, with a
          visible border against the new, darker canvas instead of a second
          stacked white shadowed card. */}
      <Card variant="flat" className="mt-5">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">מה התפקיד באמת</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 min-[480px]:grid-cols-2">
          <div>
            <p className="eyebrow">פיתוח · כ-50%</p>
            <p className="mt-1 text-[15px] leading-[24px] text-text-2">
              כלים פנימיים, אוטומציות, אינטגרציות ועבודה מול <Term>APIs</Term>.
            </p>
          </div>
          <div>
            <p className="eyebrow">תפעול טכנולוגי · כ-50%</p>
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

      <Card variant="flat" className="mt-5" data-testid="process-outline">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">איך התהליך עובד</h2>
        <ol className="mt-4 divide-y divide-line">
          <li className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3">
            <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold leading-5 text-brand-700">
              1
            </span>
            <span className="text-[16px] leading-[26px] text-text">טופס קצר</span>
            <Chip className="justify-self-end">כ-3 דקות</Chip>
          </li>
          <li className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3">
            <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold leading-5 text-brand-700">
              2
            </span>
            <span className="text-[16px] leading-[26px] text-text">תיאור התפקיד ואישור התנאים</span>
            <Chip className="justify-self-end">כ-2 דקות</Chip>
          </li>
          <li className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3">
            <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold leading-5 text-brand-700">
              3
            </span>
            <span className="text-[16px] leading-[26px] text-text">
              <strong className="font-semibold">מבחן מקוון, במחשב (לא בטלפון)</strong>
            </span>
            <Chip className="justify-self-end">כ-20 דקות</Chip>
          </li>
        </ol>
        <p className="mt-4 text-[14px] leading-[22px] text-text-2">
          כדאי לעבור את כל התהליך ברצף אחד מהמחשב — <Term>כ-25 דקות</Term>. אם בכל זאת תצטרכו לעצור,
          תקבלו קוד חזרה שמאפשר להמשיך מאותה נקודה.
        </p>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href={`/jobs/${slug}/apply`}
          className={buttonClasses({ size: "lg", fullWidth: false, className: PAGE_CTA_WIDTH_CLASS })}
          data-testid="cta-apply"
        >
          להגשת מועמדות
        </Link>
        <p className="text-[13px] leading-5 text-text-3">כ-25 דקות · במחשב</p>
      </div>
    </CandidateShell>
  );
}
