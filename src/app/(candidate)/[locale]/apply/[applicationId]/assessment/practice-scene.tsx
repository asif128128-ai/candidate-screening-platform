"use client";

import { useState } from "react";
import type { InvestigationAnswer } from "@/assessment/scoring";
import type { InvestigationContent } from "@/assessment/types";
import { InvestigationView } from "./item-views";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";

// ASSESSMENT_DESIGN.md §2: "one untimed interactive practice scene before
// block 3 (a one-artifact, one-question mini-investigation with the real
// tab UI; not scored, not telemetered)." Static, hardcoded content — this
// is intentionally not server-generated (nothing here is ever sent to the
// API: no answer submission, no integrity events).
//
// Red-team finding #6: this used to also silently force-advance the
// candidate after 90s (`PRACTICE_SCENE_AUTO_ADVANCE_MS`), directly
// contradicting the scene's own copy just below ("לא מתוזמן, לא נספר" —
// "not timed, not counted"). Removed rather than disclosed, per
// assessment-block-copy.ts's comment — the whole point of this scene is
// removing time pressure, and it's safe to remove (client-only phase, no
// server clock runs until the candidate clicks through).
//
// FINTECH_REDESIGN_PLAN.md §1.6: same runner chrome as the timed items, but
// the band is --ink-800 with a chip "תרגול · לא מתוזמן · לא נספר" instead
// of a timer, so the candidate visibly knows the clock is not running.
const PRACTICE_CONTENT: InvestigationContent = {
  ticket: 'כרטיס תרגול — "אתר החברה מציג שגיאת תעודת אבטחה (SSL) כשנכנסים אליו הבוקר."',
  tabs: [
    { key: "cert", label: "פרטי תעודה" },
    { key: "decoy", label: "הערות פריסה", decoy: true },
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

  return (
    <main className="min-h-screen bg-canvas" data-testid="practice-scene">
      <div className="sticky top-0 z-20 bg-ink-800">
        <div className="rtl-row mx-auto h-16 max-w-[1040px] items-center justify-between px-4 sm:px-6">
          <span className="text-[14px] font-semibold leading-5 text-ink-200">תרגול לפני חלק החקירה (לא מתוזמן, לא נספר)</span>
          <Chip onInk>תרגול · לא מתוזמן · לא נספר</Chip>
        </div>
      </div>

      <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6">
        <h1 className="text-[20px] font-semibold leading-7 text-text">איך עובד מסך חקירה</h1>
        <p className="mt-2 text-[14px] leading-[22px] text-text-2">
          בכל תרחיש חקירה יש כמה כרטיסיות מידע (חלקן לא רלוונטיות) ושלוש שאלות. בתרגול הזה יש שאלה אחת בלבד, לתרגול המסך.
        </p>

        <div className="mt-6">
          <Card className="p-6 lg:p-8">
            <InvestigationView content={PRACTICE_CONTENT} answer={answer} onChange={setAnswer} scored={false} />
          </Card>
        </div>

        {/* FINTECH_REDESIGN_PLAN.md block-intro/practice-scene subsection
            item 3: the practice CTA uses the runner's own action-bar layout
            (mt-8 flex justify-between, primary at the end side) so the
            candidate rehearses the real button position — an empty spacer
            fills the skip button's slot since practice has no skip. */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <span aria-hidden="true" />
          <Button type="button" fullWidth={false} className="min-w-[160px]" onClick={onProceed} data-testid="practice-scene-continue">
            המשך לחלק החקירה
          </Button>
        </div>
      </div>
    </main>
  );
}
