// reasoning.ordering_clues — ASSESSMENT_DESIGN.md §3.2. Reconstruct the
// order of 5 events from 4 partial clues. Kind: ordering.
//
// The 4 clues are always the chain of adjacent "X before/after Y" relations
// between consecutive true-order events; a chain covering every element
// forces exactly one total order by transitivity, so the puzzle is always
// solvable and never ambiguous. Difficulty is varied by phrasing (some
// links stated in reversed "X after Y" form, requiring an extra inversion
// step) rather than by leaving the order underdetermined.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

const EVENT_POOL = [
  "המשתמש נרשם",
  "אימות אימייל נשלח",
  "האימייל אומת",
  "כרטיס אשראי נוסף",
  "המנוי הופעל",
  "החשבונית הראשונה הופקה",
  "הגיבוי הראשון רץ",
  "ההרשאות הוגדרו",
];

export const template: ItemTemplate = {
  id: "reasoning.ordering_clues",
  version: 1,
  pillar: "reasoning",
  kind: "ordering",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const n = 5;
    const events = rng.sample(EVENT_POOL, n); // events[i] happens before events[i+1]

    // Always the 4-link adjacency chain (i, i+1) — this fully determines a
    // unique total order by transitivity, so the puzzle is always solvable.
    // Difficulty scales by phrasing some links in reversed "X after Y" form
    // (an inversion the candidate must do mentally) rather than by ever
    // leaving the order underdetermined.
    type Clue = { text: string };
    const clues: Clue[] = [];
    const reversedCount = difficulty === 1 ? 0 : difficulty === 2 ? 1 : 2;
    const reversedLinks = new Set(rng.sample(Array.from({ length: n - 1 }, (_, i) => i), reversedCount));
    for (let i = 0; i < n - 1; i++) {
      const before = events[i] as string;
      const after = events[i + 1] as string;
      clues.push(
        reversedLinks.has(i)
          ? { text: `"${after}" קרה אחרי "${before}".` }
          : { text: `"${before}" קרה לפני "${after}".` },
      );
    }

    const displayItems = rng.shuffle(events);
    // answerKey.correctOrder[k] = index into displayItems (the shown,
    // shuffled array) of the event that truly belongs at rank k.
    const trueRank = new Map(events.map((e, i) => [e, i]));
    const rankOfDisplayIdx = displayItems.map((e) => trueRank.get(e) as number);
    const order = displayItems
      .map((_, displayIdx) => displayIdx)
      .sort((a, b) => (rankOfDisplayIdx[a] as number) - (rankOfDisplayIdx[b] as number));

    const prompt =
      "לפניכם 5 אירועים (לא בסדר הנכון) ורמזים חלקיים. שחזרו את הסדר הכרונולוגי הנכון.\n\n" +
      `רמזים:\n${clues.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}`;

    return {
      content: { prompt, items: displayItems },
      answerKey: { kind: "ordering", correctOrder: order },
    };
  },
};
