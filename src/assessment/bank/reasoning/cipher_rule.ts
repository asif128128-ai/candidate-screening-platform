// reasoning.cipher_rule — ASSESSMENT_DESIGN.md §3.2. Two encoded examples
// reveal a transformation; encode a third. Kind: short_text.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

const WORDS = ["בית", "ילד", "כלב", "חתול", "שולחן", "ספר", "עיר", "נהר", "הר", "ים"];

interface CipherDef {
  name: string;
  encode: (s: string) => string;
}

const CIPHERS: CipherDef[] = [
  { name: "היפוך המחרוזת", encode: (s) => s.split("").reverse().join("") },
  {
    name: "הכפלת כל אות",
    encode: (s) =>
      s
        .split("")
        .map((c) => c + c)
        .join(""),
  },
  {
    name: "הוספת האות הראשונה בסוף",
    encode: (s) => s + s[0],
  },
  {
    name: "הסרת האות האחרונה",
    encode: (s) => s.slice(0, -1),
  },
];

export const template: ItemTemplate = {
  id: "reasoning.cipher_rule",
  version: 1,
  pillar: "reasoning",
  kind: "short_text",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const cipher =
      difficulty === 3
        ? {
            name: "שילוב: היפוך ואז הוספת האות הראשונה (של המקור) בסוף",
            encode: (s: string) => s.split("").reverse().join("") + s[0],
          }
        : rng.pick(CIPHERS);

    const [ex1, ex2, target] = rng.sample(WORDS, 3);
    const prompt =
      "לפניכם כלל הצפנה (לא ידוע מראש) שמודגם בשתי דוגמאות:\n\n" +
      `"${ex1}" -> "${cipher.encode(ex1 as string)}"\n` +
      `"${ex2}" -> "${cipher.encode(ex2 as string)}"\n\n` +
      `לפי אותו הכלל, מה ההצפנה של "${target}"?`;

    return {
      content: { prompt },
      answerKey: { kind: "short_text", correctText: cipher.encode(target as string) },
    };
  },
};
