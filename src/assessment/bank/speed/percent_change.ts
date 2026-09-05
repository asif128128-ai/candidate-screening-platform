// speed.percent_change — ASSESSMENT_DESIGN.md §3.1. From A to B = +?%.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

export const template: ItemTemplate = {
  id: "speed.percent_change",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const from = rng.nextIntBetween(50, 400) * (rng.chance() ? 1 : 2);
    const pct = rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 100]);
    const increase = rng.chance(0.75);
    const to = increase ? Math.round(from * (1 + pct / 100)) : Math.round(from * (1 - pct / 100));
    const actualPct = Math.round(((to - from) / from) * 100);

    const correct = `${actualPct >= 0 ? "+" : ""}${actualPct}%`;
    const prompt = `מ-${from} ל-${to}, זה שינוי של כמה אחוזים?`;

    const distractors = generateDistinctDistractors(
      3,
      [correct],
      () => {
        const noise = rng.pick([-20, -10, -5, 5, 10, 20]);
        const v = actualPct + noise;
        return `${v >= 0 ? "+" : ""}${v}%`;
      },
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
