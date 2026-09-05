import { describe, expect, it } from "vitest";
import { computeItemToken, verifyItemToken } from "@/lib/item-token";

// Trivial smoke test proving the Vitest harness (config, path alias,
// TypeScript transform) works end-to-end. Real coverage — generator.ts,
// scoring.ts, integrity.ts, normalize.ts — lands with the assessment-engine
// and candidate-flow engineers per TEST_STRATEGY.md §1-§3.
describe("test harness smoke test", () => {
  it("round-trips an item token", () => {
    const nonce = Buffer.from("0123456789abcdef", "hex");
    const token = computeItemToken("item-1", nonce, "secret");
    expect(verifyItemToken("item-1", nonce, "secret", token)).toBe(true);
    expect(verifyItemToken("item-2", nonce, "secret", token)).toBe(false);
  });
});
