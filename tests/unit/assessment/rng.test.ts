import { describe, expect, it } from "vitest";
import { createRng, deriveItemSeed, deriveSubSeed, fnv1a64 } from "@/assessment/rng";

describe("rng", () => {
  it("is deterministic: same seed produces the same sequence", () => {
    const a = createRng(42n);
    const b = createRng(42n);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = createRng(1n);
    const b = createRng(2n);
    expect(a.next()).not.toBe(b.next());
  });

  it("next() stays within [0, 1)", () => {
    const rng = createRng(7n);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt respects the exclusive upper bound", () => {
    const rng = createRng(123n);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("nextIntBetween is inclusive on both ends and covers the range over many draws", () => {
    const rng = createRng(9n);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.nextIntBetween(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it("throws on an empty range for nextInt", () => {
    const rng = createRng(1n);
    expect(() => rng.nextInt(0)).toThrow();
  });

  it("pick throws on an empty array", () => {
    const rng = createRng(1n);
    expect(() => rng.pick([])).toThrow();
  });

  it("pick always returns an element from the array", () => {
    const rng = createRng(55n);
    const pool = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(rng.pick(pool));
    }
  });

  it("shuffle returns a permutation (same multiset, not necessarily same order)", () => {
    const rng = createRng(3n);
    const input = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(input);
    expect(shuffled.slice().sort()).toEqual(input.slice().sort());
    expect(input).toEqual([1, 2, 3, 4, 5]); // does not mutate input
  });

  it("shuffle produces different orders across many draws (not a no-op)", () => {
    const rng = createRng(3n);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      orders.add(rng.shuffle(input).join(","));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("sample draws n distinct elements without repetition", () => {
    const rng = createRng(11n);
    const pool = [1, 2, 3, 4, 5, 6];
    const sampled = rng.sample(pool, 4);
    expect(sampled).toHaveLength(4);
    expect(new Set(sampled).size).toBe(4);
    for (const v of sampled) expect(pool).toContain(v);
  });

  it("sample throws when n exceeds the population", () => {
    const rng = createRng(1n);
    expect(() => rng.sample([1, 2], 3)).toThrow();
  });

  it("chance respects probability bounds (0 always false, 1 always true)", () => {
    const rng = createRng(4n);
    for (let i = 0; i < 20; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("fork produces an independent, deterministic sub-stream", () => {
    const parent1 = createRng(99n);
    const child1 = parent1.fork("options");
    const parent2 = createRng(99n);
    const child2 = parent2.fork("options");
    expect(child1.next()).toBe(child2.next());
  });

  it("fork with a different label diverges", () => {
    const parent1 = createRng(99n);
    const childA = parent1.fork("a");
    const parent2 = createRng(99n);
    const childB = parent2.fork("b");
    expect(childA.next()).not.toBe(childB.next());
  });

  it("fnv1a64 is deterministic and sensitive to input", () => {
    expect(fnv1a64("hello")).toBe(fnv1a64("hello"));
    expect(fnv1a64("hello")).not.toBe(fnv1a64("hellp"));
  });

  it("deriveItemSeed is deterministic per (sessionSeed, templateId, position)", () => {
    const s1 = deriveItemSeed(42n, "speed.json_diff", 3);
    const s2 = deriveItemSeed(42n, "speed.json_diff", 3);
    const s3 = deriveItemSeed(42n, "speed.json_diff", 4);
    const s4 = deriveItemSeed(42n, "speed.ip_valid", 3);
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
    expect(s1).not.toBe(s4);
  });

  it("deriveSubSeed differs by label", () => {
    expect(deriveSubSeed(1n, "a")).not.toBe(deriveSubSeed(1n, "b"));
  });
});
