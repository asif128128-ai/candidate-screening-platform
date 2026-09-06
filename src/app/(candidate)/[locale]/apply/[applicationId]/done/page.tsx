import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { checkCandidateCookie } from "@/lib/candidate-session";
import { getDoneInfo } from "@/db/queries/application-flow";
import { redirect } from "@/i18n/navigation";

// CANDIDATE_FLOW.md §6 — done page and closure (DECISIONS_LOG.md #3): a
// reply-by date, no personalized rejection, a privacy link. No score is
// ever shown to candidates.
// FINTECH_REDESIGN_PLAN.md §1.7 done: centered Card, 56px --mint-600
// check-circle icon, H1, the response-date promise in <Term> 600.
export default async function DonePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const cookieCheck = await checkCandidateCookie(applicationId);
  if (cookieCheck.kind === "missing") {
    redirect({ href: "/resume", locale: "he" });
  }
  if (cookieCheck.kind === "mismatch") {
    notFound();
  }

  const info = await getDoneInfo(applicationId);
  if (!info) notFound();

  const responseByDateHe = info.responseByDate.toLocaleDateString("he-IL");

  return (
    <CandidateShell width="reading" stepper={{ current: 4, allDone: true }}>
      <Card className="mx-auto max-w-[480px] text-center">
        <CheckCircleIcon />

        {info.sessionStatus === "abandoned" ? (
          <>
            <h1 className="mt-4 text-[28px] font-bold leading-9 text-ink-900">המבחן נסגר</h1>
            <p className="mt-2 text-[16px] leading-[26px] text-text-2">
              חלף זמן המקסימום למבחן. מה שנענה נשמר, והמועמדות שלך התקבלה.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[28px] font-bold leading-9 text-ink-900">המועמדות שלך התקבלה</h1>
            <p className="mt-2 text-[16px] leading-[26px] text-text-2">
              תודה, {info.candidateFirstName}. המבחן הושלם ונשמר — זה כל מה שנדרש מצידך.
            </p>
          </>
        )}

        <p className="mt-4 text-[18px] leading-7 text-text">
          נחזור אליך עד{" "}
          <Term>
            <span className="font-bold text-ink-900">{responseByDateHe}</span>
          </Term>{" "}
          במייל או בטלפון, בכל מקרה — גם אם לא נמשיך יחד הפעם.
        </p>
        <p className="mt-3 text-[13px] leading-5 text-text-3">
          אם עבר התאריך ולא שמעת מאיתנו, אפשר לכתוב אלינו (פרטי הקשר בעמוד מדיניות הפרטיות).
        </p>

        <Link href="/privacy" className="mt-6 inline-block text-[14px] leading-[22px] text-brand-600 hover:underline">
          מדיניות הפרטיות
        </Link>
      </Card>
    </CandidateShell>
  );
}

// FINTECH_REDESIGN_PLAN.md §R2.2 done: an outline check reads as a line
// icon; a filled disc reads as a state. 64px --mint-600 disc, white 28px
// check.
function CheckCircleIcon() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-600"
    >
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none">
        <path
          d="M6 14.5l5.5 5.5L22 8"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
