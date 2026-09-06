"use client";

import { formatCountdown, timerFraction, timerVisualState } from "@/lib/assessment-runner-logic";
import { Term } from "@/components/term";

// FINTECH_REDESIGN_PLAN.md §1.6: replaces the old header + timer-bar.tsx
// with a single sticky ink-navy band. Structure kept intentionally simple
// so the reduced-motion rule in globals.css ([data-testid="timer-bar"] > *)
// targets the actual transitioning fill element directly (it's now the
// testid element's direct child, not a grandchild).
//
// ASSESSMENT_DESIGN.md §2.3: "Timer is shown as a shrinking bar plus mm:ss;
// the last 10s turn amber." Color is never the only carrier of meaning
// (§5): the bar's own shrinking width plus the numeric mm:ss both signal
// urgency, and the amber state also keeps the digits bold (weight is
// already 700 in both states here, per §1.6 "digits stay 700").
export function TimerBand({
  blockName,
  blockPosition,
  position,
  totalItems,
  remainingMs,
  totalMs,
}: {
  blockName: string;
  /** Which of the 4 fixed blocks this item belongs to (1-4). */
  blockPosition: number;
  position: number;
  totalItems: number;
  remainingMs: number;
  totalMs: number;
}) {
  const fraction = timerFraction(remainingMs, totalMs);
  const state = timerVisualState(remainingMs);
  const fillColor = state === "amber" ? "bg-amber-500" : "bg-brand-400";
  const digitColor = state === "amber" ? "text-amber-500" : "text-white";

  return (
    <div className="sticky top-0 z-20 bg-ink-900">
      <div className="rtl-row mx-auto h-16 max-w-[880px] items-center justify-between px-4 sm:px-6">
        {/* FINTECH_REDESIGN_PLAN.md §R2.2 runner item 6: block-of-4 context
            above the absolute item count, so "שאלה 11 מתוך 27" reads inside
            "which of the 4 blocks am I in" instead of standing alone. */}
        <span data-testid="progress-label" className="flex flex-col gap-0.5">
          <span className="tnum text-[13px] font-semibold leading-5 text-ink-200">
            חלק {blockPosition} מתוך 4 · {blockName}
          </span>
          <span className="tnum text-base font-semibold leading-6 text-white">
            שאלה {position} מתוך {totalItems}
          </span>
        </span>
        <span data-testid="timer-text" className={`tnum text-[24px] font-bold leading-8 ${digitColor}`}>
          <Term>{formatCountdown(remainingMs)}</Term>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-ink-800" data-testid="timer-bar" data-timer-state={state}>
        <div className={`h-full ${fillColor} transition-[width] duration-200 ease-linear`} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
