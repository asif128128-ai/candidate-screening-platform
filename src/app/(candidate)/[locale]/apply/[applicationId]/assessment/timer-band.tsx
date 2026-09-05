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
  position,
  totalItems,
  remainingMs,
  totalMs,
}: {
  blockName: string;
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
      <div className="rtl-row mx-auto h-16 max-w-[1040px] items-center justify-between px-4 sm:px-6">
        <span data-testid="progress-label" className="rtl-row items-baseline gap-2">
          <span className="text-[14px] font-semibold leading-5 text-ink-200">{blockName}</span>
          <span aria-hidden="true" className="text-ink-200">
            ·
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
