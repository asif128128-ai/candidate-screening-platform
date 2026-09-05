import { describe, expect, it } from "vitest";
import {
  EventBuffer,
  computeRemainingMs,
  formatCountdown,
  isAnswerPresent,
  nextRetryDelayMs,
  timerFraction,
  timerVisualState,
  totalRetryBudgetMs,
} from "@/lib/assessment-runner-logic";

describe("computeRemainingMs", () => {
  it("subtracts client-now + skew from the server deadline", () => {
    const deadline = 100_000;
    expect(computeRemainingMs(deadline, 90_000, 0)).toBe(10_000);
  });

  it("a client clock running fast (positive skew wrong direction) is corrected by skew", () => {
    // server_now - client_now = skew. If the client clock reads ahead of the
    // server by 5s, skew = -5000; remaining should reflect the server's view.
    const deadline = 100_000;
    const clientNow = 95_000; // client thinks it's 95s, but server time is really 90s (client is 5s fast)
    const skew = -5_000; // server_now(90000) - client_now(95000)
    expect(computeRemainingMs(deadline, clientNow, skew)).toBe(10_000);
  });

  it("goes negative once the deadline has passed (never clamped here — callers decide what to do)", () => {
    expect(computeRemainingMs(100_000, 105_000, 0)).toBe(-5_000);
  });
});

describe("formatCountdown", () => {
  it("formats mm:ss with zero-padded seconds", () => {
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("never shows negative time", () => {
    expect(formatCountdown(-5_000)).toBe("0:00");
  });

  it("rounds up partial seconds so the display doesn't hit 0:00 before the deadline actually passes", () => {
    expect(formatCountdown(1_200)).toBe("0:02");
  });
});

describe("timerVisualState", () => {
  it("is normal above 10s remaining", () => {
    expect(timerVisualState(10_001)).toBe("normal");
  });
  it("turns amber at exactly 10s and below (ASSESSMENT_DESIGN.md §2.3)", () => {
    expect(timerVisualState(10_000)).toBe("amber");
    expect(timerVisualState(1)).toBe("amber");
  });
  it("is expired at and below zero", () => {
    expect(timerVisualState(0)).toBe("expired");
    expect(timerVisualState(-100)).toBe("expired");
  });
});

describe("timerFraction", () => {
  it("computes the fraction of time remaining, clamped to [0,1]", () => {
    expect(timerFraction(10_000, 20_000)).toBe(0.5);
    expect(timerFraction(25_000, 20_000)).toBe(1);
    expect(timerFraction(-5_000, 20_000)).toBe(0);
  });
  it("never divides by zero", () => {
    expect(timerFraction(5_000, 0)).toBe(0);
  });
});

describe("retry/backoff schedule (CANDIDATE_FLOW.md §5: retry with backoff up to 15s)", () => {
  it("provides an increasing delay for each attempt, then stops", () => {
    const delays: number[] = [];
    for (let i = 0; ; i++) {
      const d = nextRetryDelayMs(i);
      if (d === null) break;
      delays.push(d);
    }
    expect(delays.length).toBeGreaterThan(0);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1] as number);
    }
  });

  it("the total budget is in the ballpark of 15s as documented", () => {
    expect(totalRetryBudgetMs()).toBeGreaterThanOrEqual(14_000);
    expect(totalRetryBudgetMs()).toBeLessThanOrEqual(20_000);
  });

  it("returns null once attempts are exhausted", () => {
    expect(nextRetryDelayMs(1000)).toBeNull();
  });
});

describe("EventBuffer (ANTI_CHEATING.md §3: cap 200, then counters only)", () => {
  it("buffers events up to the cap and returns them on drain", () => {
    const buf = new EventBuffer();
    buf.push({ kind: "artifact_open", position: 1, atMs: 100 });
    buf.push({ kind: "artifact_open", position: 1, atMs: 200 });
    expect(buf.size).toBe(2);
    const drained = buf.drain();
    expect(drained).toHaveLength(2);
    expect(buf.size).toBe(0); // drained, buffer is empty again
  });

  it("stops buffering individual events past 200 and counts overflow per kind instead", () => {
    const buf = new EventBuffer();
    for (let i = 0; i < 205; i++) {
      buf.push({ kind: "copy_attempt", position: 1, atMs: i });
    }
    expect(buf.size).toBe(200);
    expect(buf.overflowCounts().get("copy_attempt")).toBe(5);
  });

  it("tracks overflow separately per event kind", () => {
    const buf = new EventBuffer();
    for (let i = 0; i < 200; i++) buf.push({ kind: "a", position: null, atMs: i });
    buf.push({ kind: "b", position: null, atMs: 1 });
    buf.push({ kind: "b", position: null, atMs: 2 });
    expect(buf.overflowCounts().get("b")).toBe(2);
    expect(buf.overflowCounts().get("a")).toBeUndefined();
  });
});

describe("isAnswerPresent (drives the submit button's disabled state)", () => {
  it("single_choice requires a selected index", () => {
    expect(isAnswerPresent("single_choice", null)).toBe(false);
    expect(isAnswerPresent("single_choice", { selectedIndex: null })).toBe(false);
    expect(isAnswerPresent("single_choice", { selectedIndex: 0 })).toBe(true);
  });
  it("multi_choice requires at least one selection", () => {
    expect(isAnswerPresent("multi_choice", { selectedIndexes: [] })).toBe(false);
    expect(isAnswerPresent("multi_choice", { selectedIndexes: [1] })).toBe(true);
  });
  it("numeric requires a non-empty value (0 counts)", () => {
    expect(isAnswerPresent("numeric", { value: null })).toBe(false);
    expect(isAnswerPresent("numeric", { value: "" })).toBe(false);
    expect(isAnswerPresent("numeric", { value: 0 })).toBe(true);
  });
  it("short_text requires non-whitespace content", () => {
    expect(isAnswerPresent("short_text", { text: "   " })).toBe(false);
    expect(isAnswerPresent("short_text", { text: "x" })).toBe(true);
  });
  it("ordering requires a non-empty order array", () => {
    expect(isAnswerPresent("ordering", { order: [] })).toBe(false);
    expect(isAnswerPresent("ordering", { order: [0, 1] })).toBe(true);
  });
  it("investigation requires all three sub-answers", () => {
    expect(isAnswerPresent("investigation", { q1: 0, q2: null, q3: "x" })).toBe(false);
    expect(isAnswerPresent("investigation", { q1: 0, q2: 0, q3: "" })).toBe(false);
    expect(isAnswerPresent("investigation", { q1: 0, q2: 0, q3: "x" })).toBe(true);
  });
});
