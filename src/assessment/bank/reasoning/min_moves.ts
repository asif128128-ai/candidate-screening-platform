// reasoning.min_moves — ASSESSMENT_DESIGN.md §3.2. Small optimization:
// minimal steps/cost under 2 rules. Kind: numeric.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

export const template: ItemTemplate = {
  id: "reasoning.min_moves",
  version: 1,
  pillar: "reasoning",
  kind: "numeric",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    if (difficulty <= 2) {
      // Buy N items where a bundle of `bundleSize` costs `bundlePrice` and a
      // single item costs `singlePrice`. Minimum total cost.
      const need = rng.nextIntBetween(9, 22);
      const bundleSize = rng.pick([3, 4, 5]);
      const bundlePrice = bundleSize * rng.pick([8, 9]);
      const singlePrice = rng.pick([10, 11, 12]);

      let minCost = Infinity;
      const maxBundles = Math.ceil(need / bundleSize);
      for (let bundles = 0; bundles <= maxBundles; bundles++) {
        const covered = bundles * bundleSize;
        const remaining = Math.max(0, need - covered);
        const cost = bundles * bundlePrice + remaining * singlePrice;
        if (cost < minCost) minCost = cost;
      }

      const prompt =
        `צריך לקנות בדיוק ${need} יחידות של פריט מסוים. אפשר לקנות חבילה של ${bundleSize} יחידות ב-${bundlePrice} ₪, ` +
        `או יחידה בודדת ב-${singlePrice} ₪ (אפשר לקנות יותר מהצורך אם זה יוצא זול יותר). מה העלות המינימלית האפשרית?`;

      return { content: { prompt, unit: "₪" }, answerKey: { kind: "numeric", correctValue: minCost } };
    }

    // difficulty 3: minimum number of "steps" to reach a target using two
    // step sizes (classic coin/step optimization, small enough to brute force).
    const target = rng.nextIntBetween(15, 30);
    const stepA = rng.pick([2, 3]);
    const stepB = rng.pick([5, 7]);

    let minSteps = Infinity;
    for (let a = 0; a * stepA <= target; a++) {
      const remainder = target - a * stepA;
      if (remainder % stepB === 0) {
        const steps = a + remainder / stepB;
        if (steps < minSteps) minSteps = steps;
      }
    }

    const prompt =
      `רובוט זז בקפיצות של ${stepA} או ${stepB} צעדים בכל פעם, בכיוון אחד בלבד. מה המספר המינימלי של קפיצות כדי להגיע בדיוק למרחק ${target}?`;

    return { content: { prompt }, answerKey: { kind: "numeric", correctValue: minSteps } };
  },
};
