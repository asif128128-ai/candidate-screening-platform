// TODO(assessment-engine engineer): deadline math, grace, clock-skew
// handling (ARCHITECTURE.md §5.2). Pure function, no I/O. Must handle the
// Israel DST edge case by working in UTC throughout (TEST_STRATEGY.md §3).

export interface DeadlineInfo {
  deadlineAt: Date;
  serverNow: Date;
  msRemaining: number;
}

export function computeDeadline(_servedAt: Date, _timeLimitS: number): Date {
  throw new Error("computeDeadline() not implemented — see ARCHITECTURE.md §5.2");
}

/** 2 s network grace per ARCHITECTURE.md §5.2. */
export const ANSWER_GRACE_MS = 2000;
