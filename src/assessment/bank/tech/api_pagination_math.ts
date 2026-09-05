// tech.api_pagination_math — ASSESSMENT_DESIGN.md §3.4. Doc excerpt (page
// size, rate limit) + record count -> number of calls / minimum time.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

export const template: ItemTemplate = {
  id: "tech.api_pagination_math",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated:
    "התיעוד קובע את גודל העמוד (page size) ואת מגבלת הקצב (rate limit) — שניהם מצוינים בפריט.",
  generate(rng: Rng, difficulty: Difficulty) {
    const pageSize = rng.pick([50, 100, 200]);
    const records = rng.nextIntBetween(3, 20) * pageSize + rng.nextIntBetween(1, pageSize - 1);
    const callsPerMinute = rng.pick([30, 60, 120]);
    const totalCalls = Math.ceil(records / pageSize);

    const docExcerpt =
      `מתוך התיעוד: "כל קריאה מחזירה עד ${pageSize} רשומות (page size). מותר עד ${callsPerMinute} קריאות בדקה."`;

    let correctValue: number;
    let question: string;
    if (difficulty === 1) {
      correctValue = totalCalls;
      question = "כמה קריאות API נדרשות בסך הכול כדי למשוך את כל הרשומות?";
    } else {
      const minutes = Math.ceil(totalCalls / callsPerMinute);
      correctValue = minutes;
      question = "מה משך הזמן המינימלי (בדקות, מעוגל כלפי מעלה) הדרוש כדי למשוך את כל הרשומות בלי לחרוג ממגבלת הקצב?";
    }

    const prompt = `${docExcerpt}\n\nיש ${records} רשומות למשוך.\n\n${question}`;

    const distractors = generateDistinctDistractors(
      3,
      [String(correctValue)],
      () => String(Math.max(1, correctValue + rng.pick([-3, -2, -1, 1, 2, 3, 4, 5]))),
      (v) => v,
    );

    const { options, correctIndex } = shuffleOptions(rng, String(correctValue), distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
      conventionsStated: docExcerpt,
    };
  },
};
