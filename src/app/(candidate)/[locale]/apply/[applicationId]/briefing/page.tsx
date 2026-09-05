import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
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
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">לפני המבחן</h1>
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

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">לפני המבחן</h1>

      <section className="mt-4 text-sm leading-relaxed">
        <h2 className="font-semibold">מה זה</h2>
        <p className="mt-2">
          מבחן קצר ואינטנסיבי, כ-30 דקות, 27 שאלות ב-4 חלקים: חימום מהיר, חשיבה, חקירה, אינסטינקט
          טכנולוגי. הוא בודק איך אתם חושבים ומתמודדים עם בעיות אמיתיות — לא מה שיננתם. לפני חלק
          החקירה יש תרגול קצר, לא מתוזמן ולא נחשב לציון, כדי להכיר את המסך.
        </p>
      </section>

      <section className="mt-4 text-sm leading-relaxed">
        <h2 className="font-semibold">הכללים</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>לכל שאלה זמן קצוב משלה</li>
          <li>אין חזרה אחורה</li>
          <li>אפשר לדלג על שאלה, אבל מומלץ תמיד לנסות לענות — כל מה שנדרש נמצא בשאלה עצמה</li>
          <li>רענון של הדף לא מאפס את השעון</li>
          <li>אחרי שמתחילים — מסיימים באותו רצף (מגבלה כוללת של <Term>75</Term> דקות)</li>
        </ul>
      </section>

      <section className="mt-4 text-sm leading-relaxed">
        <h2 className="font-semibold">מה לצפות</h2>
        <p className="mt-2">
          הזמנים נבנו כך שרוב הסטודנטים החזקים מסיימים כל שאלה עם זמן לרזרבה. לא צריך הכנה, חיפוש
          באינטרנט או כלי <Term>AI</Term> — השאלות בנויות כך שהם פשוט לא עוזרים בזמן הנתון. אין כל
          דבר שצריך לדעת בעל פה: כל מה שנדרש נמצא בשאלה עצמה.
        </p>
      </section>

      <BriefingPanel applicationId={applicationId} />
    </main>
  );
}
