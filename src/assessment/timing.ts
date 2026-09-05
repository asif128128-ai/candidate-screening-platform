// timing.ts — deadline math, grace, clock-skew handling (ARCHITECTURE.md
// §5.2). Pure function, no I/O. Everything here operates on epoch
// milliseconds (via `Date`/`number`), which is inherently DST-safe: a
// Date's internal representation is a UTC timestamp, so adding seconds
// never double-counts or skips the "fall back"/"spring forward" hour the
// way local-calendar arithmetic (setHours etc.) could — see
// timing.test.ts's Israel-DST-boundary case for the regression guard.

/** 2 s network grace per ARCHITECTURE.md §5.2. */
export const ANSWER_GRACE_MS = 2000;

/** liveness gap threshold that defines a server outage window (ARCHITECTURE.md §5.2). */
export const OUTAGE_GAP_THRESHOLD_MS = 20000;

/** liveness touch interval (ARCHITECTURE.md §5.2). */
export const LIVENESS_TOUCH_INTERVAL_MS = 15000;

/** clock skew jump that counts as a `clock_anomaly` event (ANTI_CHEATING.md §3). */
export const CLOCK_ANOMALY_THRESHOLD_MS = 5000;

/** deadline_at = served_at + time_limit_s (ARCHITECTURE.md §5.2, DATA_MODEL.md §3.11). */
export function computeDeadline(servedAt: Date, timeLimitS: number): Date {
  return new Date(servedAt.getTime() + timeLimitS * 1000);
}

/** Milliseconds remaining until deadline, as measured `at` a given instant (can be negative once past). */
export function msRemaining(deadlineAt: Date, at: Date): number {
  return deadlineAt.getTime() - at.getTime();
}

/**
 * Whether a submission received at `receivedAt` is on time, allowing the 2 s
 * network grace (ARCHITECTURE.md §5.2: "checks now() <= deadline_at + 2 s
 * grace"). Returns the amount of lateness within grace (0 if on time or
 * early) or `null` if genuinely too late (should be recorded as expired).
 */
export function evaluateSubmission(deadlineAt: Date, receivedAt: Date): { lateByMs: number } | null {
  const diff = receivedAt.getTime() - deadlineAt.getTime();
  if (diff <= 0) return { lateByMs: 0 };
  if (diff <= ANSWER_GRACE_MS) return { lateByMs: diff };
  return null;
}

/** Client clock skew, measured on every response: server_now - Date.now() at the client (ARCHITECTURE.md §5.2). */
export function computeSkewMs(serverNow: Date, clientNow: Date): number {
  return serverNow.getTime() - clientNow.getTime();
}

/** The client-side timer's remaining ms, corrected for measured skew. */
export function clientRemainingMs(deadlineAt: Date, clientNow: Date, skewMs: number): number {
  return deadlineAt.getTime() - (clientNow.getTime() + skewMs);
}

/** `clock_anomaly` event trigger: skew jumped more than the threshold between two requests. */
export function hasClockAnomaly(prevSkewMs: number, newSkewMs: number): boolean {
  return Math.abs(newSkewMs - prevSkewMs) > CLOCK_ANOMALY_THRESHOLD_MS;
}

/**
 * Server-outage window detection at boot (ARCHITECTURE.md §5.2): compares
 * the `liveness` row's last-touched time against the process's own start
 * time. A gap larger than the threshold means the process was down while
 * items may have been live.
 */
export function detectOutageWindow(livenessAt: Date, bootAt: Date): { start: Date; end: Date } | null {
  const gapMs = bootAt.getTime() - livenessAt.getTime();
  if (gapMs <= OUTAGE_GAP_THRESHOLD_MS) return null;
  return { start: livenessAt, end: bootAt };
}

/**
 * The overlap, in ms, between an item's live window [servedAt, deadlineAt]
 * and an outage window, capped at one full time_limit_s — exactly what
 * `apply_outage_credit()` computes in SQL (0001_init.sql §7.4). Exposed
 * here so the same math can be unit-tested without a live database.
 */
export function outageOverlapMs(
  servedAt: Date,
  deadlineAt: Date,
  timeLimitS: number,
  windowStart: Date,
  windowEnd: Date,
): number {
  const overlapStart = Math.max(servedAt.getTime(), windowStart.getTime());
  const overlapEnd = Math.min(deadlineAt.getTime(), windowEnd.getTime());
  const overlap = overlapEnd - overlapStart;
  if (overlap <= 0) return 0;
  return Math.min(overlap, timeLimitS * 1000);
}
