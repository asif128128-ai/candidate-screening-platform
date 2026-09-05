// speed.timezone_shift — ASSESSMENT_DESIGN.md §3.1. The UTC-Israel offset
// is stated in the item so no timezone-table knowledge is assumed.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, pad2, shuffleOptions } from "../helpers";

function fmtTime(h: number, m: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${pad2(hh)}:${pad2(m)}`;
}

export const template: ItemTemplate = {
  id: "speed.timezone_shift",
  version: 2,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "השעה בישראל מאוחרת ב-{offset} שעות משעון UTC",
  generate(rng: Rng) {
    const offset = rng.pick([2, 3]); // winter/summer, stated explicitly
    const hourUtc = rng.nextIntBetween(0, 23);
    const minute = rng.pick([0, 15, 30, 45]);
    const correctHour = hourUtc + offset;
    const correct = fmtTime(correctHour, minute);

    const prompt =
      `בתקופה הנוכחית השעה בישראל מאוחרת ב-${offset} שעות משעון UTC.\n` +
      `כשהשעה ב-UTC היא ${fmtTime(hourUtc, minute)}, מה השעה בישראל?`;

    const distractors = generateDistinctDistractors(
      3,
      [correct],
      () => fmtTime(correctHour + rng.pick([-2, -1, 1, 2]), minute),
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
      conventionsStated: `השעה בישראל מאוחרת ב-${offset} שעות משעון UTC`,
    };
  },
};
