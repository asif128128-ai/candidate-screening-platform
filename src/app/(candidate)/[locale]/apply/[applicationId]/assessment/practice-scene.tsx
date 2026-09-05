"use client";

import { useEffect, useState } from "react";
import type { InvestigationAnswer } from "@/assessment/scoring";
import type { InvestigationContent } from "@/assessment/types";
import { PRACTICE_SCENE_AUTO_ADVANCE_MS } from "@/lib/assessment-block-copy";
import { InvestigationView } from "./item-views";

// ASSESSMENT_DESIGN.md §2: "one untimed interactive practice scene before
// block 3 (a one-artifact, one-question mini-investigation with the real
// tab UI; not scored, not telemetered, auto-advances after 90s)." Static,
// hardcoded content — this is intentionally not server-generated (nothing
// here is ever sent to the API: no answer submission, no integrity events).
const PRACTICE_CONTENT: InvestigationContent = {
  ticket: 'כרטיס תרגול — "אתר החברה מציג שגיאת תעודת אבטחה (SSL) כשנכנסים אליו הבוקר."',
  tabs: [
    { key: "cert", label: "פרטי תעודה" },
    { key: "decoy", label: "הערות פריסה (decoy)", decoy: true },
  ].map((t) => ({
    ...t,
    body:
      t.key === "cert"
        ? "דומיין: www.example.co.il\nתוקף עד: 2025-01-10\nהתאריך היום: 2025-01-12\nמנפיק: Let's Encrypt"
        : "2025-01-09 – עדכון גרסת Node לשרת, ללא שינוי בהגדרות רשת.",
  })),
  q1: {
    prompt: "מה שורש הבעיה?",
    options: ["תוקף התעודה פג", "השרת נפל", "כתובת ה-DNS שגויה"],
  },
  q2: { prompt: "לא רלוונטי בתרגול", options: ["—"] },
  q3: { prompt: "לא רלוונטי בתרגול", placeholder: "" },
};

export function PracticeScene({ onProceed }: { onProceed: () => void }) {
  const [answer, setAnswer] = useState<InvestigationAnswer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(PRACTICE_SCENE_AUTO_ADVANCE_MS / 1000));

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = PRACTICE_SCENE_AUTO_ADVANCE_MS - (Date.now() - start);
      if (remaining <= 0) {
        clearInterval(interval);
        onProceed();
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-8" data-testid="practice-scene">
      <p className="text-sm text-neutral-500">תרגול לפני חלק החקירה (לא מתוזמן, לא נספר)</p>
      <h1 className="mt-1 text-xl font-semibold">איך עובד מסך חקירה</h1>
      <p className="mt-2 text-sm text-neutral-600">
        בכל תרחיש חקירה יש כמה כרטיסיות מידע (חלקן לא רלוונטיות) ושלוש שאלות. בתרגול הזה יש שאלה אחת בלבד, לתרגול המסך.
      </p>

      <div className="mt-6">
        <InvestigationView content={PRACTICE_CONTENT} answer={answer} onChange={setAnswer} scored={false} />
      </div>

      <button
        type="button"
        onClick={onProceed}
        className="mt-8 w-full rounded-md bg-neutral-900 py-3 font-medium text-white"
        data-testid="practice-scene-continue"
      >
        המשך לחלק החקירה
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">ממשיכים אוטומטית בעוד {secondsLeft} שניות</p>
    </main>
  );
}
