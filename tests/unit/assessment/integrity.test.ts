import { describe, expect, it } from "vitest";
import { computeIntegrity, type IntegrityEvent, type IntegrityItem, type IntegrityResponse } from "@/assessment/integrity";

function makeItems(n: number, timeLimitS = 20): IntegrityItem[] {
  return Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    kind: "single_choice" as const,
    difficulty: 1 as const,
    timeLimitS,
  }));
}

function honestResponses(items: IntegrityItem[]): IntegrityResponse[] {
  return items.map((it) => ({
    position: it.position,
    isCorrect: true,
    responseMs: it.timeLimitS * 1000 * 0.5,
    firstInteractionMs: 1500,
  }));
}

function honestEvents(items: IntegrityItem[]): IntegrityEvent[] {
  // Every item gets at least one client event, matching a real runner.
  return items.map((it) => ({ position: it.position, kind: "answer_change" as const }));
}

describe("computeIntegrity — a fully honest session", () => {
  it("lands at low risk with no reasons", () => {
    const items = makeItems(27);
    const result = computeIntegrity(items, honestResponses(items), honestEvents(items));
    expect(result.risk).toBe("low");
    expect(result.reasons).toEqual([]);
    expect(result.score).toBe(0);
  });
});

describe("computeIntegrity — TELEMETRY_GAP and its hard floors (ANTI_CHEATING.md §5.3)", () => {
  it("a fully scripted run (zero client telemetry) lands at high regardless of plausible timing", () => {
    const items = makeItems(27);
    const responses: IntegrityResponse[] = items.map((it) => ({
      position: it.position,
      isCorrect: true,
      responseMs: it.timeLimitS * 1000 * 0.6, // plausible human timing
      firstInteractionMs: null, // no client telemetry at all
    }));
    const result = computeIntegrity(items, responses, []); // no events whatsoever
    expect(result.risk).toBe("high");
    const reason = result.reasons.find((r) => r.code === "TELEMETRY_GAP");
    expect(reason).toBeDefined();
    expect(reason?.he).toContain("27 מתוך 27");
  });

  it("floors at medium when 20-39% of items are telemetry-empty", () => {
    const items = makeItems(10);
    const responses: IntegrityResponse[] = items.map((it, i) => ({
      position: it.position,
      isCorrect: true,
      responseMs: 5000,
      firstInteractionMs: i < 3 ? null : 1000, // 3/10 = 30% empty
    }));
    const events: IntegrityEvent[] = items.slice(3).map((it) => ({ position: it.position, kind: "answer_change" }));
    const result = computeIntegrity(items, responses, events);
    expect(result.risk).not.toBe("low");
  });

  it("stays low below the 5% telemetry-empty normalization floor with no other signal", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events = honestEvents(items).slice(1); // exactly 1/27 (~3.7%) empty
    const result = computeIntegrity(items, responses, events);
    expect(result.risk).toBe("low");
  });
});

describe("computeIntegrity — HIDDEN_DURING_ITEMS and HIDDEN_THEN_CORRECT_LATE", () => {
  it("flags items with an 8s+ hidden span while the item was live", () => {
    const items = makeItems(10);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      { position: 1, kind: "visibility_visible", durationMs: 9000 },
      { position: 2, kind: "visibility_visible", durationMs: 9000 },
    ];
    const result = computeIntegrity(items, responses, events);
    const reason = result.reasons.find((r) => r.code === "HIDDEN_DURING_ITEMS");
    expect(reason).toBeDefined();
    expect(reason?.evidence).toMatchObject({ count: 2 });
  });

  it("ignores a hidden span under the 8s threshold", () => {
    const items = makeItems(10);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [...honestEvents(items), { position: 1, kind: "visibility_visible", durationMs: 3000 }];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "HIDDEN_DURING_ITEMS")).toBeUndefined();
  });

  it("flags hidden-then-correct-late: hidden span + correct + submitted in the last 25% of time", () => {
    const items = makeItems(10, 100); // 100s limit
    const responses: IntegrityResponse[] = items.map((it) => ({
      position: it.position,
      isCorrect: true,
      responseMs: 90000, // in the last 25% of 100s
      firstInteractionMs: 1000,
    }));
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      { position: 1, kind: "visibility_visible", durationMs: 9000 },
      { position: 2, kind: "visibility_visible", durationMs: 9000 },
      { position: 3, kind: "visibility_visible", durationMs: 9000 },
    ];
    const result = computeIntegrity(items, responses, events);
    const reason = result.reasons.find((r) => r.code === "HIDDEN_THEN_CORRECT_LATE");
    expect(reason).toBeDefined();
  });

  it("excuses a hidden span on an item with a network_retry event (ANTI_CHEATING.md §5.2)", () => {
    const items = makeItems(10);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      { position: 1, kind: "visibility_visible", durationMs: 9000 },
      { position: 1, kind: "network_retry" },
    ];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "HIDDEN_DURING_ITEMS")).toBeUndefined();
  });

  it("excuses a hidden span on an item with outage_credit_ms > 0", () => {
    const items = makeItems(10);
    items[0] = { ...items[0]!, outageCreditMs: 5000 };
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [...honestEvents(items), { position: 1, kind: "visibility_visible", durationMs: 9000 }];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "HIDDEN_DURING_ITEMS")).toBeUndefined();
  });
});

describe("computeIntegrity — BLUR_DURING_ITEMS corroboration rule (§5.1) and its cap (§5.3)", () => {
  it("a blur-only pattern with no other signal can never exceed low risk", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      ...Array.from({ length: 8 }, (_, i) => ({ position: i + 1, kind: "window_focus" as const, durationMs: 9000 })),
    ];
    const result = computeIntegrity(items, responses, events);
    expect(result.risk).toBe("low");
  });

  it("counts blur at full weight once corroborated by another signal", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      ...Array.from({ length: 8 }, (_, i) => ({ position: i + 1, kind: "window_focus" as const, durationMs: 9000 })),
      { position: null, kind: "ip_change" }, // unambiguous corroborating signal
    ];
    const result = computeIntegrity(items, responses, events);
    const reason = result.reasons.find((r) => r.code === "BLUR_DURING_ITEMS");
    expect(reason).toBeDefined();
    // Full weight (8) * normalized(8/6 clamped to 1) = 8, not 8*0.4=3.2.
    expect(reason?.weight).toBeCloseTo(8, 5);
  });

  it("does not double-count an item as both hidden and blur", () => {
    const items = makeItems(10);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [
      ...honestEvents(items),
      { position: 1, kind: "visibility_visible", durationMs: 9000 },
      { position: 1, kind: "window_focus", durationMs: 9000 },
    ];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "HIDDEN_DURING_ITEMS")?.evidence).toMatchObject({ count: 1 });
    expect(result.reasons.find((r) => r.code === "BLUR_DURING_ITEMS")).toBeUndefined();
  });
});

describe("computeIntegrity — INSTANCE_OR_DEVICE (§5.1, §5.3)", () => {
  it("any instance_conflict floors risk to at least medium", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [...honestEvents(items), { position: null, kind: "instance_conflict" }];
    const result = computeIntegrity(items, responses, events);
    expect(result.risk).not.toBe("low");
    expect(result.reasons.find((r) => r.code === "INSTANCE_OR_DEVICE")?.weight).toBeCloseTo(10, 5);
  });

  it("normalizes to 0.5 for exactly one kind (e.g. only an ip_change)", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [...honestEvents(items), { position: null, kind: "ip_change" }];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "INSTANCE_OR_DEVICE")?.weight).toBeCloseTo(5, 5);
  });

  it("does not flag a single instance_new (needs >= 2 for the always-on signal)", () => {
    const items = makeItems(27);
    const responses = honestResponses(items);
    const events: IntegrityEvent[] = [...honestEvents(items), { position: null, kind: "instance_new" }];
    const result = computeIntegrity(items, responses, events);
    expect(result.reasons.find((r) => r.code === "INSTANCE_OR_DEVICE")).toBeUndefined();
  });
});

describe("computeIntegrity — IMPOSSIBLE_TIMING", () => {
  it("flags a difficulty-3 item answered correctly in under 20% of the time limit", () => {
    const items: IntegrityItem[] = [{ position: 1, kind: "single_choice", difficulty: 3, timeLimitS: 60 }];
    const responses: IntegrityResponse[] = [{ position: 1, isCorrect: true, responseMs: 5000, firstInteractionMs: 1000 }];
    const result = computeIntegrity(items, responses, [{ position: 1, kind: "answer_change" }]);
    expect(result.reasons.find((r) => r.code === "IMPOSSIBLE_TIMING")).toBeDefined();
  });

  it("flags 3+ items with first_interaction under 300ms", () => {
    const items = makeItems(5);
    const responses: IntegrityResponse[] = items.map((it) => ({
      position: it.position,
      isCorrect: true,
      responseMs: 5000,
      firstInteractionMs: 100,
    }));
    const result = computeIntegrity(items, responses, honestEvents(items));
    expect(result.reasons.find((r) => r.code === "IMPOSSIBLE_TIMING")).toBeDefined();
  });

  it("excuses a difficulty-3 fast-correct item that had an outage credit", () => {
    const items: IntegrityItem[] = [{ position: 1, kind: "single_choice", difficulty: 3, timeLimitS: 60, outageCreditMs: 1000 }];
    const responses: IntegrityResponse[] = [{ position: 1, isCorrect: true, responseMs: 5000, firstInteractionMs: 1000 }];
    const result = computeIntegrity(items, responses, [{ position: 1, kind: "answer_change" }]);
    expect(result.reasons.find((r) => r.code === "IMPOSSIBLE_TIMING")).toBeUndefined();
  });
});

describe("computeIntegrity — ARTIFACT_BLIND_CORRECT", () => {
  it("flags 2+ investigation items answered correctly without opening the decisive artifact", () => {
    const items: IntegrityItem[] = [
      { position: 1, kind: "investigation", difficulty: 2, timeLimitS: 180 },
      { position: 2, kind: "investigation", difficulty: 2, timeLimitS: 180 },
    ];
    const responses: IntegrityResponse[] = items.map((it) => ({
      position: it.position,
      isCorrect: true,
      responseMs: 60000,
      firstInteractionMs: 1000,
      decisiveArtifactOpened: false,
    }));
    const result = computeIntegrity(items, responses, honestEvents(items));
    expect(result.reasons.find((r) => r.code === "ARTIFACT_BLIND_CORRECT")).toBeDefined();
  });
});

describe("computeIntegrity — reasons are sorted by contribution, descending", () => {
  it("orders the reasons list by weight * normalized", () => {
    const items = makeItems(27);
    const responses: IntegrityResponse[] = items.map((it, i) => ({
      position: it.position,
      isCorrect: true,
      responseMs: 5000,
      firstInteractionMs: i < 12 ? null : 1000, // large telemetry gap -> big contributor
    }));
    const events: IntegrityEvent[] = [
      ...items.slice(12).map((it) => ({ position: it.position, kind: "answer_change" as const })),
      { position: null, kind: "ip_change" }, // small contributor
    ];
    const result = computeIntegrity(items, responses, events);
    const contributions = result.reasons.map((r) => r.weight);
    const sorted = [...contributions].sort((a, b) => b - a);
    expect(contributions).toEqual(sorted);
  });
});
