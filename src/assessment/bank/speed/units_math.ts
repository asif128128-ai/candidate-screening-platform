// speed.units_math — ASSESSMENT_DESIGN.md §3.1. Item defines
// parallel/serial explicitly, per DECISIONS_LOG.md #8.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

const RULE =
  'ריצה "בטור" (serial): הזמנים מצטברים אחד אחרי השני. ריצה "במקביל" (parallel): הזמן הכולל הוא הזמן הארוך ביותר מביניהם, כי כולם רצים יחד.';

export const template: ItemTemplate = {
  id: "speed.units_math",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: RULE,
  generate(rng: Rng) {
    const count = rng.nextIntBetween(3, 5);
    const timeMs = rng.pick([100, 150, 200, 250, 300, 400]);
    const parallel = rng.chance();
    const correctMs = parallel ? timeMs : timeMs * count;

    const prompt =
      `${RULE}\n\n` +
      `${count} שרתים, כל אחד לוקח ${timeMs} מ"ש (ms), רצים ${parallel ? "במקביל" : "בטור"}. מה הזמן הכולל?`;

    const distractors = generateDistinctDistractors(
      3,
      [`${correctMs} מ"ש`],
      () => {
        const alt = parallel ? timeMs * count : timeMs;
        const noisy = rng.pick([alt, timeMs * (count - 1), timeMs * (count + 1)]);
        return `${noisy} מ"ש`;
      },
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, `${correctMs} מ"ש`, distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
