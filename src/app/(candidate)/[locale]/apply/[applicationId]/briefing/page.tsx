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
        {/* ASSESSMENT_DESIGN.md §2 / 0014_blueprint_v3_knowledge_block.sql: 37
            items in 5 blocks, listed in the order the runner actually serves
            them (BLOCK_ORDER / blockKeyForPosition). "לא מה שיננתם" was
            dropped: with the knowledge block it is no longer true, and telling
            candidates memory does not matter right before asking what DNS is
            would be a straightforward lie. */}
        <p className="mt-2 text-[16px] leading-[26px] text-text">
          מבחן קצר ואינטנסיבי, כ-25 דקות, 37 שאלות ב-5 חלקים: חימום מהיר, ידע טכנולוגי, חשיבה,
          אינסטינקט טכנולוגי, וחקירה. רוב השאלות קצרות מאוד. לפני חלק החקירה יש תרגול קצר, לא מתוזמן
          ולא נחשב לציון, כדי להכיר את המסך.
        </p>

        <h2 className="mt-5 border-t border-line pt-5 text-[20px] font-semibold leading-7 text-ink-900">
          מה לצפות
        </h2>
        <p className="mt-2 text-[16px] leading-[26px] text-text">
          הזמנים נבנו כך שרוב הסטודנטים החזקים מסיימים כל שאלה עם זמן לרזרבה. בחלק של ידע טכנולוגי
          נשאל על מושגים מהעולם הטכנולוגי — מי שמכיר אותם עונה בשניות ספורות. בכל שאר החלקים כל מה
          שנדרש נמצא בשאלה עצמה, ואין מה ללמוד מראש.
        </p>

        {/* ASSESSMENT_DESIGN.md §2.2 — the anti-externalization declaration.
            It replaces the previous claim that AI tools "simply don't help",
            which over-claimed: at the old 60-180 s limits they demonstrably
            did. This says the true thing instead (the round trip costs more
            time than it saves) and states the expectation openly, which is
            the part that actually changes an honest candidate's behavior.
            Emphasised as its own block because it is a house rule, not a
            detail. */}
        <p
          className="mt-4 border-t border-line pt-4 text-[16px] leading-[26px] text-text"
          data-testid="ai-declaration"
        >
          השאלות מהירות בכוונה — לרוב כמה עשרות שניות לכל אחת. הן בנויות כך שלפנות לאפליקציית{" "}
          <Term>AI</Term> ייקח יותר זמן ממה שזה יחסוך, ובינתיים השעון רץ. מה שמעניין אותנו זה איך{" "}
          <strong className="font-semibold text-ink-900">אתם</strong> חושבים — לעבוד עם הראש שלכם, זה
          כל העניין.
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
