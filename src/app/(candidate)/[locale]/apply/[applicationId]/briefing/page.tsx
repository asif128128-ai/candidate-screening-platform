import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { guardApplicationStep, stepPath } from "@/lib/application-guard";
import { BriefingPanel } from "./briefing-panel";

// CANDIDATE_FLOW.md §4 — step 3: לפני המבחן.
export default async function BriefingPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const guard = await guardApplicationStep(applicationId, "briefing");

  if (guard.kind === "already_past") {
    return (
      <CandidateShell width="reading" stepper={{ current: 3 }}>
        <Card className="mx-auto max-w-[480px] text-center">
          <h1 className="h1">לפני המבחן</h1>
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

  return (
    <CandidateShell width="reading" stepper={{ current: 3 }}>
      <h1 className="h1">לפני המבחן</h1>

      {/* FINTECH_REDESIGN_PLAN.md §R2.2 briefing item 1 / §R2.3.3: four
          identical raised cards read as "a template" — "מה זה" and "מה
          לצפות" merge into one flat card (two sections divided by a rule);
          "הכללים" stays its own flat card. */}
      <Card variant="flat" className="mt-8">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">מה זה</h2>
        <p className="mt-2 text-[16px] leading-[26px] text-text">
          מבחן קצר ואינטנסיבי, כ-20 דקות, 27 שאלות ב-4 חלקים: חימום מהיר, חשיבה, חקירה, אינסטינקט
          טכנולוגי. הוא בודק איך אתם חושבים ומתמודדים עם בעיות אמיתיות — לא מה שיננתם. לפני חלק
          החקירה יש תרגול קצר, לא מתוזמן ולא נחשב לציון, כדי להכיר את המסך.
        </p>

        <h2 className="mt-5 border-t border-line pt-5 text-[20px] font-semibold leading-7 text-ink-900">
          מה לצפות
        </h2>
        <p className="mt-2 text-[16px] leading-[26px] text-text">
          הזמנים נבנו כך שרוב הסטודנטים החזקים מסיימים כל שאלה עם זמן לרזרבה. לא צריך הכנה, חיפוש
          באינטרנט או כלי <Term>AI</Term> — השאלות בנויות כך שהם פשוט לא עוזרים בזמן הנתון. אין כל
          דבר שצריך לדעת בעל פה: כל מה שנדרש נמצא בשאלה עצמה.
        </p>
      </Card>

      <Card variant="flat" className="mt-5">
        <h2 className="text-[20px] font-semibold leading-7 text-ink-900">הכללים</h2>
        <ul className="mt-3 space-y-3">
          {[
            "לכל שאלה זמן קצוב משלה",
            "אין חזרה אחורה",
            "אפשר לדלג על שאלה, אבל מומלץ תמיד לנסות לענות — כל מה שנדרש נמצא בשאלה עצמה",
            "רענון של הדף לא מאפס את השעון",
          ].map((rule) => (
            <li key={rule} className="rtl-row items-start gap-2 text-[16px] leading-[26px] text-text">
              <RuleIcon />
              <span>{rule}</span>
            </li>
          ))}
          <li className="rtl-row items-start gap-2 text-[16px] leading-[26px] text-text">
            <RuleIcon />
            <span>
              אחרי שמתחילים — מסיימים באותו רצף (מגבלה כוללת של <Term>75</Term> דקות)
            </span>
          </li>
        </ul>
      </Card>

      <BriefingPanel applicationId={applicationId} />
    </CandidateShell>
  );
}

function RuleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" aria-hidden="true">
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
