// reasoning.analogy_structural — ASSESSMENT_DESIGN.md §3.2. Relation A:B,
// pick C:? — relations are structural, not vocabulary-dependent.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Relation {
  name: string;
  pairs: Array<[string, string]>;
}

// Each relation is a *structural* mapping (container->content, tool->action,
// cause->effect) so the analogy can't be solved from word associations alone
// — the same relation must be re-derived on a fresh pair.
const RELATIONS: Relation[] = [
  {
    name: "כלי -> הפעולה שהוא מבצע",
    pairs: [
      ["מברג", "להברגה"],
      ["מספריים", "לחיתוך"],
      ["מטאטא", "לטאטוא"],
      ["מברשת", "לצביעה"],
      ["פטיש", "להקשה"],
    ],
  },
  {
    name: "מכל -> מה שבתוכו",
    pairs: [
      ["ארון", "בגדים"],
      ["מקרר", "אוכל"],
      ["ספרייה", "ספרים"],
      ["מחסן", "ציוד"],
      ["אקווריום", "דגים"],
    ],
  },
  {
    name: "יחיד -> רבים (של אותה קבוצה)",
    pairs: [
      ["חייל", "פלוגה"],
      ["עץ", "יער"],
      ["ספינה", "צי"],
      ["כוכב", "צביר"],
      ["דבורה", "כוורת"],
    ],
  },
  {
    name: "שלב מוקדם -> שלב מאוחר באותו תהליך",
    pairs: [
      ["זרע", "פרי"],
      ["ביצה", "אפרוח"],
      ["טיוטה", "מסמך סופי"],
      ["תרשים", "מוצר מוגמר"],
      ["גולם", "פרפר"],
    ],
  },
];

export const template: ItemTemplate = {
  id: "reasoning.analogy_structural",
  version: 1,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const relation = rng.pick(RELATIONS);
    const [examplePair, targetPair] = rng.sample(relation.pairs, 2);
    const [exA, exB] = examplePair as [string, string];
    const [tgA, tgB] = targetPair as [string, string];

    // Distractors: the target's first element paired with a B from a
    // *different* relation, or from a different pair within the same
    // relation family (wrong pairing, not wrong relation type).
    const otherRelations = RELATIONS.filter((r) => r.name !== relation.name);
    const distractorBs = new Set<string>();
    while (distractorBs.size < 3) {
      const r = rng.pick(otherRelations.length > 0 ? otherRelations : RELATIONS);
      const pair = rng.pick(r.pairs);
      if (pair[1] !== tgB) distractorBs.add(pair[1]);
    }

    const prompt = `${exA} שייך ל-${exB} באותו יחס ש-${tgA} שייך ל-?`;
    const { options, correctIndex } = shuffleOptions(rng, tgB, [...distractorBs]);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
