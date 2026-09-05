// tech.webhook_vs_polling — ASSESSMENT_DESIGN.md §3.4. Integration need ->
// best mechanism (webhook / polling interval / batch export) and why.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  need: string;
  correct: string;
  wrong: string[];
}

const CASES: Case[] = [
  {
    need: "מערכת חיצונית תומכת ב-webhooks, וצריך לדעת מיד כשמזמינים מוצר כדי לעדכן מלאי בזמן אמת",
    correct: "webhook — הספק שולח התראה ברגע שהאירוע קורה, ואין צורך לבדוק שוב ושוב",
    wrong: [
      "polling כל 24 שעות — מספיק כי מדובר במלאי",
      "ייצוא קובץ ידני פעם בשבוע",
      "polling כל שנייה כדי לא לפספס כלום",
    ],
  },
  {
    need: "מערכת חיצונית ישנה בלי תמיכה ב-webhooks, וצריך לדעת על שינויים תוך כמה דקות",
    correct: "polling כל 2-5 דקות — התדירות הכי גבוהה שסבירה כשאין webhook, בלי להעמיס יתר על המידה",
    wrong: [
      "webhook — גם אם המערכת לא תומכת בזה",
      "ייצוא קובץ פעם בחודש",
      "polling פעם ביום מספיק",
    ],
  },
  {
    need: "צריך להעביר פעם בלילה את כל הנתונים ההיסטוריים לצורך דוח שבועי, בלי צורך בעדכון מיידי",
    correct: "ייצוא batch מתוזמן פעם ביום/שבוע — מתאים כשאין צורך בזמן אמת והנפח גדול",
    wrong: [
      "webhook על כל שינוי — מיותר לצורך דוח שבועי",
      "polling כל דקה",
      "polling כל שנייה כדי לוודא עדכניות",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.webhook_vs_polling",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const prompt = `${c.need}\n\nמה מנגנון האינטגרציה המתאים ביותר, ומדוע?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
