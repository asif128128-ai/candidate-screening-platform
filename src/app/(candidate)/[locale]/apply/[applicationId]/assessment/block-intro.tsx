"use client";

import { useEffect, useState } from "react";
import { BLOCK_INTRO_AUTO_ADVANCE_MS, type BlockCopy } from "@/lib/assessment-block-copy";

// ASSESSMENT_DESIGN.md §2: "block intro screens with the block's rules and
// time-per-item. Untimed for the candidate's benefit but auto-advances
// after 45s so the wall clock can't be gamed." §3.5: each intro has a
// collapsed "איך זה עובד" panel (opening it is not scored, shown to the
// admin as context only per that section — this runner doesn't need to log
// whether it was opened; that's out of scope for the hot-path telemetry
// list in ANTI_CHEATING.md §3, which doesn't include it).
export function BlockIntro({ block, onProceed }: { block: BlockCopy; onProceed: () => void }) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(BLOCK_INTRO_AUTO_ADVANCE_MS / 1000));

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = BLOCK_INTRO_AUTO_ADVANCE_MS - (Date.now() - start);
      if (remaining <= 0) {
        clearInterval(interval);
        onProceed();
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.key]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center p-8" data-testid="block-intro" data-block-key={block.key}>
      <p className="text-sm text-neutral-500">החלק הבא</p>
      <h1 className="mt-1 text-2xl font-semibold">{block.nameHe}</h1>
      <p className="mt-4 text-neutral-700">{block.ruleHe}</p>

      <button
        type="button"
        onClick={() => setHowItWorksOpen((v) => !v)}
        className="mt-4 text-start text-sm underline"
        data-testid="how-it-works-toggle"
      >
        איך זה עובד
      </button>
      {howItWorksOpen ? <p className="mt-2 text-sm leading-relaxed text-neutral-600">{block.howItWorksHe}</p> : null}

      <button
        type="button"
        onClick={onProceed}
        className="mt-8 w-full rounded-md bg-neutral-900 py-3 font-medium text-white"
        data-testid="block-intro-continue"
      >
        להתחיל
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">ממשיכים אוטומטית בעוד {secondsLeft} שניות</p>
    </main>
  );
}
