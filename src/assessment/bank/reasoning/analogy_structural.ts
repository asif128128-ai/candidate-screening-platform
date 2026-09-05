// reasoning.analogy_structural — ASSESSMENT_DESIGN.md §3.2. Relation A:B,
// pick C:? — relations are structural, not vocabulary-dependent.
//
// Difficulty scales via *where the distractors come from*, not the relation
// itself (ASSESSMENT_DESIGN.md's "the convention is in the item" spirit
// applied to reasoning: harder items require finer-grained structural
// matching, not new facts): d1 distractors are all from unrelated relation
// families (wrong category, easy to eliminate on sight); d2 mixes in one
// same-family near-miss (right category, wrong specific pair); d3 draws
// every distractor from the target's own relation family (right category
// for all options — only exact pair-structure matching distinguishes the
// answer).
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Relation {
  name: string;
  pairs: Array<[string, string]>;
}

// Each relation is a *structural* mapping (container->content, tool->action,
// cause->effect) so the analogy can't be solved from word associations alone
// — the same relation must be re-derived on a fresh pair.
// Exported (only) so bank.test.ts can verify the difficulty-scaling
// invariant below by relation-family membership, not just option count.
export const RELATIONS: Relation[] = [
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
  generate(rng: Rng, difficulty: Difficulty) {
    const relation = rng.pick(RELATIONS);
    const [examplePair, targetPair] = rng.sample(relation.pairs, 2);
    const [exA, exB] = examplePair as [string, string];
    const [tgA, tgB] = targetPair as [string, string];

    const otherRelations = RELATIONS.filter((r) => r.name !== relation.name);
    // Every other B from this same relation family, excluding the two pairs
    // already used above (there are 5 pairs per family, so 3 remain).
    const sameFamilyBs = relation.pairs
      .filter((p) => p !== examplePair && p !== targetPair)
      .map((p) => p[1]);

    const distractorBs = new Set<string>();
    const addFromOtherRelation = () => {
      let tries = 0;
      while (tries < 50) {
        const r = rng.pick(otherRelations.length > 0 ? otherRelations : RELATIONS);
        const pair = rng.pick(r.pairs);
        if (pair[1] !== tgB && !distractorBs.has(pair[1])) {
          distractorBs.add(pair[1]);
          return;
        }
        tries++;
      }
    };
    const addFromSameFamily = () => {
      const remaining = sameFamilyBs.filter((b) => !distractorBs.has(b));
      if (remaining.length > 0) distractorBs.add(rng.pick(remaining));
      else addFromOtherRelation();
    };

    if (difficulty === 1) {
      // Easy: every distractor is an obviously wrong category.
      while (distractorBs.size < 3) addFromOtherRelation();
    } else if (difficulty === 2) {
      // Medium: one same-family near-miss mixed in with cross-family noise.
      addFromSameFamily();
      while (distractorBs.size < 3) addFromOtherRelation();
    } else {
      // Hard: every distractor is the right *category* — only the exact
      // structural pairing (not just "the right kind of relation") is the tell.
      while (distractorBs.size < 3) addFromSameFamily();
    }

    const prompt = `${exA} שייך ל-${exB} באותו יחס ש-${tgA} שייך ל-?`;
    const { options, correctIndex } = shuffleOptions(rng, tgB, [...distractorBs]);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
