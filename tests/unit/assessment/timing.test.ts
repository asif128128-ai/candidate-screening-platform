import { describe, expect, it } from "vitest";
import {
  ANSWER_GRACE_MS,
  CLOCK_ANOMALY_THRESHOLD_MS,
  OUTAGE_GAP_THRESHOLD_MS,
  clientRemainingMs,
  computeDeadline,
  computeSkewMs,
  detectOutageWindow,
  evaluateSubmission,
  hasClockAnomaly,
  msRemaining,
  outageOverlapMs,
} from "@/assessment/timing";

describe("computeDeadline", () => {
  it("adds time_limit_s seconds to served_at", () => {
    const servedAt = new Date("2026-01-01T10:00:00.000Z");
    const deadline = computeDeadline(servedAt, 20);
    expect(deadline.toISOString()).toBe("2026-01-01T10:00:20.000Z");
  });

  it("handles the Israel DST spring-forward boundary without losing or gaining an hour", () => {
    // Israel DST 2026 starts 2026-03-27 02:00 IST -> 03:00 IDT (clocks skip forward).
    // Using UTC epoch math throughout, computeDeadline must be unaffected by this.
    const servedAt = new Date("2026-03-27T00:59:50.000Z"); // 02:59:50 Israel time, just before the jump
    const deadline = computeDeadline(servedAt, 20);
    // Pure epoch-ms arithmetic: exactly 20 real seconds later, regardless of local wall-clock jumps.
    expect(deadline.getTime() - servedAt.getTime()).toBe(20000);
    expect(deadline.toISOString()).toBe("2026-03-27T01:00:10.000Z");
  });

  it("handles the Israel DST fall-back boundary (duplicated local hour) without ambiguity", () => {
    // Israel DST 2026 ends 2026-10-25 (clocks fall back an hour). Epoch math is
    // monotonic regardless of the local time repeating itself.
    const servedAt = new Date("2026-10-24T23:59:50.000Z");
    const deadline = computeDeadline(servedAt, 180);
    expect(deadline.getTime() - servedAt.getTime()).toBe(180000);
  });
});

describe("msRemaining", () => {
  it("is positive before the deadline and negative after", () => {
    const deadline = new Date("2026-01-01T10:00:20.000Z");
    expect(msRemaining(deadline, new Date("2026-01-01T10:00:10.000Z"))).toBe(10000);
    expect(msRemaining(deadline, new Date("2026-01-01T10:00:25.000Z"))).toBe(-5000);
  });
});

describe("evaluateSubmission", () => {
  const deadline = new Date("2026-01-01T10:00:20.000Z");

  it("accepts on-time submissions with lateByMs 0", () => {
    expect(evaluateSubmission(deadline, new Date("2026-01-01T10:00:19.000Z"))).toEqual({ lateByMs: 0 });
    expect(evaluateSubmission(deadline, deadline)).toEqual({ lateByMs: 0 });
  });

  it("accepts submissions within the grace window, reporting lateness", () => {
    const receivedAt = new Date(deadline.getTime() + 1500);
    expect(evaluateSubmission(deadline, receivedAt)).toEqual({ lateByMs: 1500 });
  });

  it("accepts exactly at the grace boundary", () => {
    const receivedAt = new Date(deadline.getTime() + ANSWER_GRACE_MS);
    expect(evaluateSubmission(deadline, receivedAt)).toEqual({ lateByMs: ANSWER_GRACE_MS });
  });

  it("rejects (returns null) once past the grace window", () => {
    const receivedAt = new Date(deadline.getTime() + ANSWER_GRACE_MS + 1);
    expect(evaluateSubmission(deadline, receivedAt)).toBeNull();
  });
});

describe("computeSkewMs / clientRemainingMs / hasClockAnomaly", () => {
  it("computes skew as server time minus client time", () => {
    const serverNow = new Date("2026-01-01T10:00:05.000Z");
    const clientNow = new Date("2026-01-01T10:00:00.000Z");
    expect(computeSkewMs(serverNow, clientNow)).toBe(5000);
  });

  it("clientRemainingMs corrects the client's naive countdown by the measured skew", () => {
    const deadline = new Date("2026-01-01T10:00:20.000Z");
    const clientNow = new Date("2026-01-01T10:00:10.000Z");
    // Client clock is 5s behind server; without correction it would see 10s left.
    expect(clientRemainingMs(deadline, clientNow, 5000)).toBe(5000);
  });

  it("flags a clock jump larger than the threshold", () => {
    expect(hasClockAnomaly(0, CLOCK_ANOMALY_THRESHOLD_MS + 1)).toBe(true);
    expect(hasClockAnomaly(0, CLOCK_ANOMALY_THRESHOLD_MS)).toBe(false);
    expect(hasClockAnomaly(1000, 1000)).toBe(false);
    expect(hasClockAnomaly(-1000, 1000 + CLOCK_ANOMALY_THRESHOLD_MS)).toBe(true);
  });
});

describe("detectOutageWindow", () => {
  it("returns null when the gap is within the threshold", () => {
    const livenessAt = new Date("2026-01-01T10:00:00.000Z");
    const bootAt = new Date(livenessAt.getTime() + OUTAGE_GAP_THRESHOLD_MS);
    expect(detectOutageWindow(livenessAt, bootAt)).toBeNull();
  });

  it("returns the window when the gap exceeds the threshold", () => {
    const livenessAt = new Date("2026-01-01T10:00:00.000Z");
    const bootAt = new Date(livenessAt.getTime() + OUTAGE_GAP_THRESHOLD_MS + 1000);
    const window = detectOutageWindow(livenessAt, bootAt);
    expect(window).toEqual({ start: livenessAt, end: bootAt });
  });
});

describe("outageOverlapMs", () => {
  const servedAt = new Date("2026-01-01T10:00:00.000Z");
  const deadlineAt = new Date("2026-01-01T10:03:00.000Z"); // 180s item

  it("returns 0 when the outage window does not overlap the item's live window", () => {
    const windowStart = new Date("2026-01-01T09:00:00.000Z");
    const windowEnd = new Date("2026-01-01T09:30:00.000Z");
    expect(outageOverlapMs(servedAt, deadlineAt, 180, windowStart, windowEnd)).toBe(0);
  });

  it("returns the full overlap when the outage window is inside the item's live window", () => {
    const windowStart = new Date("2026-01-01T10:00:30.000Z");
    const windowEnd = new Date("2026-01-01T10:01:00.000Z");
    expect(outageOverlapMs(servedAt, deadlineAt, 180, windowStart, windowEnd)).toBe(30000);
  });

  it("caps the overlap at one full time_limit_s even if the outage window is longer", () => {
    const windowStart = new Date("2026-01-01T09:00:00.000Z");
    const windowEnd = new Date("2026-01-01T12:00:00.000Z"); // way longer than 180s
    expect(outageOverlapMs(servedAt, deadlineAt, 180, windowStart, windowEnd)).toBe(180000);
  });

  it("handles partial overlap at the start of the item's window", () => {
    const windowStart = new Date("2026-01-01T09:59:00.000Z");
    const windowEnd = new Date("2026-01-01T10:00:30.000Z");
    expect(outageOverlapMs(servedAt, deadlineAt, 180, windowStart, windowEnd)).toBe(30000);
  });

  it("handles partial overlap at the end of the item's window", () => {
    const windowStart = new Date("2026-01-01T10:02:30.000Z");
    const windowEnd = new Date("2026-01-01T10:05:00.000Z");
    expect(outageOverlapMs(servedAt, deadlineAt, 180, windowStart, windowEnd)).toBe(30000);
  });
});
