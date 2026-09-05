// speed.bool_logic — ASSESSMENT_DESIGN.md §3.1: "8 × 6 shapes = 48 (used
// at most once/session)". The legend is stated in the item.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const LEGEND = "מקרא: `&&` = וגם (and), `||` = או (or), `!` = לא (not).";

interface Shape {
  text: string;
  eval: (a: boolean, b: boolean, c: boolean) => boolean;
}

const SHAPES: Shape[] = [
  { text: "(A && !B) || C", eval: (a, b, c) => (a && !b) || c },
  { text: "(A || B) && !C", eval: (a, b, c) => (a || b) && !c },
  { text: "!(A && B) || C", eval: (a, b, c) => !(a && b) || c },
  { text: "A && (B || !C)", eval: (a, b, c) => a && (b || !c) },
  { text: "!A || (B && C)", eval: (a, b, c) => !a || (b && c) },
  { text: "(A || !B) && C", eval: (a, b, c) => (a || !b) && c },
  { text: "A && !B && C", eval: (a, b, c) => a && !b && c },
  { text: "!(A || C) && B", eval: (a, b, c) => !(a || c) && b },
];

// Exactly six non-degenerate truth assignments, excluding the two fully
// uniform ones (all-true / all-false) so the item never rewards a blind
// "everything is the same" guess.
const TRUTH_COMBOS: Array<[boolean, boolean, boolean]> = [
  [true, true, false],
  [true, false, true],
  [true, false, false],
  [false, true, true],
  [false, true, false],
  [false, false, true],
];

export const template: ItemTemplate = {
  id: "speed.bool_logic",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: LEGEND,
  maxOncePerSession: true,
  generate(rng: Rng) {
    const shape = rng.pick(SHAPES);
    const [a, b, c] = rng.pick(TRUTH_COMBOS);
    const value = shape.eval(a, b, c);

    const prompt =
      `${LEGEND}\n\n` +
      `נתון: A = ${a ? "אמת" : "שקר"}, B = ${b ? "אמת" : "שקר"}, C = ${c ? "אמת" : "שקר"}.\n` +
      `מה הערך של הביטוי \`${shape.text}\`?`;

    const { options, correctIndex } = shuffleOptions(rng, value ? "אמת" : "שקר", [value ? "שקר" : "אמת"]);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
