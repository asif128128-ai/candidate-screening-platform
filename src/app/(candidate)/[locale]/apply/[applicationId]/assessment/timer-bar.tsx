"use client";

import { formatCountdown, timerFraction, timerVisualState } from "@/lib/assessment-runner-logic";
import { Term } from "@/components/term";

// ASSESSMENT_DESIGN.md §2.3: "Timer is shown as a shrinking bar plus mm:ss;
// the last 10s turn amber." Color is never the only carrier of meaning
// (§5): the bar's own shrinking width plus the numeric mm:ss both signal
// urgency, and the amber state also bolds the text.
export function TimerBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = timerFraction(remainingMs, totalMs);
  const state = timerVisualState(remainingMs);
  const barColor = state === "amber" ? "bg-amber-500" : "bg-neutral-900";
  return (
    <div className="w-full" data-testid="timer-bar" data-timer-state={state}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full ${barColor} transition-[width] duration-200 ease-linear`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <div
        className={`mt-1 text-end text-sm ${state === "amber" ? "font-bold text-amber-700" : "text-neutral-500"}`}
        data-testid="timer-text"
      >
        <Term>{formatCountdown(remainingMs)}</Term>
      </div>
    </div>
  );
}
