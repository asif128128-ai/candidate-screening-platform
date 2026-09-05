// Pure client-side logic for the assessment runner (ASSESSMENT_DESIGN.md
// §2.3, ARCHITECTURE.md §5.2, ANTI_CHEATING.md §3). No DOM, no fetch — unit
// tested directly. The runner component (runner.tsx) is the only caller;
// keeping this here (rather than inline) is what makes the countdown math,
// retry/backoff schedule, and event-buffer capping testable without a
// browser.

// ---------------------------------------------------------------------------
// Countdown display — server-authoritative deadline, client-corrected clock
// ---------------------------------------------------------------------------

/**
 * ARCHITECTURE.md §5.2: "Client timer = deadline_at − (Date.now() + skew)
 * where skew = server_now − Date.now() measured on each response." The
 * client never starts its own timer from a duration — it only ever
 * re-derives "how much is left" from the server-issued deadline, which is
 * what makes a stale/wrong client clock harmless and a refresh resume to
 * the exact same remaining time.
 */
export function computeRemainingMs(deadlineAtMs: number, clientNowMs: number, skewMs: number): number {
  return deadlineAtMs - (clientNowMs + skewMs);
}

/** mm:ss, floor never negative (ASSESSMENT_DESIGN.md §2.3: "shown as ... mm:ss"). */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type TimerVisualState = "normal" | "amber" | "expired";

/** ASSESSMENT_DESIGN.md §2.3: "the last 10s turn amber." */
export function timerVisualState(remainingMs: number): TimerVisualState {
  if (remainingMs <= 0) return "expired";
  if (remainingMs <= 10_000) return "amber";
  return "normal";
}

/** Fraction of the shrinking timer bar still filled, clamped to [0,1]. */
export function timerFraction(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(1, remainingMs / totalMs));
}

// ---------------------------------------------------------------------------
// Submit retry/backoff — CANDIDATE_FLOW.md §5: "retry with backoff up to 15s"
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const;

/** Delay before retry attempt `attempt` (0-indexed); null once the budget is exhausted. */
export function nextRetryDelayMs(attempt: number): number | null {
  return attempt >= 0 && attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt]! : null;
}

/** Total wall-clock budget the retry schedule spans, for display/tests ("~15s"). */
export function totalRetryBudgetMs(): number {
  return RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Integrity event buffer — ANTI_CHEATING.md §3: "buffer cap 200 events;
// beyond that only counters are kept per kind."
// ---------------------------------------------------------------------------

export interface BufferedEvent {
  kind: string;
  position: number | null;
  atMs: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

const EVENT_BUFFER_CAP = 200;

export class EventBuffer {
  private events: BufferedEvent[] = [];
  private overflow = new Map<string, number>();

  push(e: BufferedEvent): void {
    if (this.events.length < EVENT_BUFFER_CAP) {
      this.events.push(e);
    } else {
      this.overflow.set(e.kind, (this.overflow.get(e.kind) ?? 0) + 1);
    }
  }

  /** Returns and clears the buffered events (call when flushing to the server). */
  drain(): BufferedEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  peek(): readonly BufferedEvent[] {
    return this.events;
  }

  overflowCounts(): ReadonlyMap<string, number> {
    return this.overflow;
  }

  get size(): number {
    return this.events.length;
  }
}

// ---------------------------------------------------------------------------
// Answer presence — drives the "שלח/י" button's disabled state
// ---------------------------------------------------------------------------

export type RunnerItemKind = "single_choice" | "multi_choice" | "numeric" | "short_text" | "ordering" | "investigation";

/** Whether the candidate has entered enough to submit (vs. skip). Mirrors src/assessment/scoring.ts's CandidateAnswer shapes. */
export function isAnswerPresent(kind: RunnerItemKind, answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;
  const a = answer as Record<string, unknown>;
  switch (kind) {
    case "single_choice":
      return typeof a.selectedIndex === "number";
    case "multi_choice":
      return Array.isArray(a.selectedIndexes) && a.selectedIndexes.length > 0;
    case "numeric":
      return a.value !== null && a.value !== undefined && a.value !== "";
    case "short_text":
      return typeof a.text === "string" && a.text.trim().length > 0;
    case "ordering":
      return Array.isArray(a.order) && a.order.length > 0;
    case "investigation":
      return a.q1 !== null && a.q1 !== undefined && a.q2 !== null && a.q2 !== undefined && typeof a.q3 === "string" && a.q3.trim().length > 0;
    default:
      return false;
  }
}
