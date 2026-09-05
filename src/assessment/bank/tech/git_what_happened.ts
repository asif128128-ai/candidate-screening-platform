// tech.git_what_happened — ASSESSMENT_DESIGN.md §3.4. Two-branch story ->
// why a change "disappeared". conventions_stated: n/a (the story itself
// carries every fact needed).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  story: string;
  correct: string;
  wrong: string[];
}

const CASES: Case[] = [
  {
    story:
      "דנה עבדה על branch בשם feature/login, ביצעה שם כמה commits, ואז ביצעה merge של main לתוך feature/login (כדי להתעדכן). " +
      "לאחר מכן היא מחקה בטעות את branch feature/login מבלי למזג אותו חזרה ל-main. השינויים שלה נעלמו.",
    correct: "ה-commits היו קיימים רק ב-feature/login ומעולם לא מוזגו חזרה ל-main; מחיקת ה-branch איבדה את הגישה הרגילה אליהם",
    wrong: [
      "Git מוחק אוטומטית commits ישנים יותר משבוע",
      "merge של main לתוך feature/login מוחק תמיד את השינויים המקומיים",
      "השינויים נמחקו כי הן לא נדחפו (push) לשרת מעולם — זו הסיבה היחידה האפשרית",
    ],
  },
  {
    story:
      "יוסי עבד על branch בשם fix/bug-42, ביצע commit, ואז עשה force-push ל-branch אחרי שעשה rebase שסידר מחדש את ה-commits. " +
      "עמית שהיה גם הוא על אותו branch משך (pull) רגיל וקיבל קונפליקטים מוזרים, ולבסוף חלק מהשינויים שלו נראו כאילו נעלמו.",
    correct: "force-push אחרי rebase שינה את היסטוריית ה-branch; pull רגיל של העמית (בלי rebase מתאים) יצר עותק היסטוריה מבולבל שהסתיר חלק מהשינויים",
    wrong: [
      "rebase תמיד מוחק שינויים של אנשים אחרים לצמיתות בלי אפשרות שחזור",
      "force-push חסום מטבעו ב-Git ולא יכול לקרות בפועל",
      "הקונפליקטים נגרמו מבעיה ברשת ולא קשורים לפעולות ב-Git",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.git_what_happened",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const prompt = `${c.story}\n\nמה קרה כאן, בסבירות הגבוהה ביותר?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
