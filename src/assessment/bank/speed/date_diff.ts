// speed.date_diff — ASSESSMENT_DESIGN.md §3.1. Days between two dates in
// the same month. conventions_stated: n/a.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { HEBREW_MONTHS, generateDistinctDistractors, shuffleOptions } from "../helpers";

export const template: ItemTemplate = {
  id: "speed.date_diff",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const monthIdx = rng.nextInt(12);
    const day1 = rng.nextIntBetween(1, 20);
    const gap = rng.nextIntBetween(1, 9);
    const day2 = day1 + gap;
    const monthName = HEBREW_MONTHS[monthIdx] as string;

    const prompt = `כמה ימים יש בין ${day1} ב${monthName} לבין ${day2} ב${monthName} (אותה שנה)?`;

    const distractors = generateDistinctDistractors(
      3,
      [String(gap)],
      () => String(Math.max(0, gap + rng.pick([-3, -2, -1, 1, 2, 3, 4]))),
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, String(gap), distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
