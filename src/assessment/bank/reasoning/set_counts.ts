// reasoning.set_counts — ASSESSMENT_DESIGN.md §3.2. "Of 40 tickets, 22 are
// bugs, 18 urgent, 9 both... how many neither?" Kind: numeric.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

const CATEGORY_PAIRS: Array<[string, string, string]> = [
  ["כרטיסים", "באג", "דחוף"],
  ["מועמדים", "עם ניסיון", "מהאזור"],
  ["בקשות", "שאושרו החודש", "בטיפול צוות התמיכה"],
  ["הזמנות", "בינלאומיות", "ששולמו בכרטיס אשראי"],
];

export const template: ItemTemplate = {
  id: "reasoning.set_counts",
  version: 1,
  pillar: "reasoning",
  kind: "numeric",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const [noun, catA, catB] = rng.pick(CATEGORY_PAIRS);
    const total = rng.nextIntBetween(30, 60);
    // a, b each capped at 45% of total so a + b <= total always, which
    // guarantees "both" can range down to 0 and "neither" is never negative
    // regardless of how much overlap is drawn.
    const a = rng.nextIntBetween(Math.floor(total * 0.25), Math.floor(total * 0.45));
    const b = rng.nextIntBetween(Math.floor(total * 0.25), Math.floor(total * 0.45));
    const maxBoth = Math.min(a, b);
    const both = rng.nextIntBetween(0, maxBoth);
    const neither = total - (a + b - both);

    let prompt: string;
    let askFor: number;
    if (difficulty === 1) {
      prompt = `מתוך ${total} ${noun}, ${a} הם "${catA}", ${b} הם "${catB}", ומתוכם ${both} הם גם וגם. כמה ${noun} אינם לא זה ולא זה (neither)?`;
      askFor = neither;
    } else if (difficulty === 2) {
      // ask for "exactly one of the two" instead
      const exactlyOne = a + b - 2 * both;
      prompt = `מתוך ${total} ${noun}, ${a} הם "${catA}", ${b} הם "${catB}", ומתוכם ${both} הם גם וגם. כמה ${noun} שייכים לקטגוריה אחת בדיוק (לא לשתיהן, ולא לאף אחת)?`;
      askFor = exactlyOne;
    } else {
      // difficulty 3: given neither, solve for "both" (reverse the puzzle)
      prompt =
        `מתוך ${total} ${noun}, ${a} הם "${catA}", ${b} הם "${catB}", ו-${neither} אינם לא זה ולא זה. ` +
        `כמה ${noun} הם גם "${catA}" וגם "${catB}"?`;
      askFor = both;
    }

    return { content: { prompt }, answerKey: { kind: "numeric", correctValue: askFor } };
  },
};
