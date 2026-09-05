// tech.git_what_happened — ASSESSMENT_DESIGN.md §3.4. Two-branch story ->
// why a change "disappeared". conventions_stated: n/a (the story itself
// carries every fact needed).
//
// Only difficulties 2-3 are declared (a single dropped-branch story doesn't
// have a genuinely "easy" version worth adding at d1). d2 uses the simpler
// story (an unmerged branch deleted outright — one cause, one mechanism);
// d3 pool has two subtler stories (force-push-after-rebase, and an
// interactive-rebase squash) where the history is still recoverable but the
// mechanism has more moving parts and the wrong options are closer misses.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  story: string;
  correct: string;
  wrong: string[];
}

const CASES_MODERATE: Case[] = [
  {
    story:
      "דנה עבדה על branch בשם feature/login, ביצעה שם כמה commits, ואז ביצעה merge של main לתוך feature/login (כדי להתעדכן). " +
      "לאחר מכן היא מחקה בטעות את branch feature/login מבלי למזג אותו חזרה ל-main. השינויים שלה נעלמו.",
    correct: "ה-commits היו קיימים רק ב-feature/login ומעולם לא מוזגו חזרה ל-main; מחיקת ה-branch איבדה את הגישה הרגילה אליהם",
    wrong: [
      "Git מוחק אוטומטית commits ישנים יותר משבוע כדי לחסוך מקום בדיסק, כחלק ממנגנון ניקוי תקופתי מובנה, גם אם הם לא מוזגו",
      "merge של main לתוך feature/login מוחק תמיד באופן אוטומטי את כל השינויים המקומיים שהיו קיימים על ה-branch מלכתחילה",
      "השינויים נמחקו סופית כי הן מעולם לא נדחפו (push) לשרת מרוחק כלשהו — זו הסיבה היחידה האפשרית שיכולה להסביר את זה",
    ],
  },
];

const CASES_HARD: Case[] = [
  {
    story:
      "יוסי עבד על branch בשם fix/bug-42, ביצע commit, ואז עשה force-push ל-branch אחרי שעשה rebase שסידר מחדש את ה-commits. " +
      "עמית שהיה גם הוא על אותו branch משך (pull) רגיל וקיבל קונפליקטים מוזרים, ולבסוף חלק מהשינויים שלו נראו כאילו נעלמו.",
    correct: "force-push אחרי rebase שינה את היסטוריית ה-branch; pull רגיל של העמית (בלי rebase מתאים) יצר עותק היסטוריה מבולבל שהסתיר חלק מהשינויים",
    wrong: [
      "rebase תמיד מוחק לצמיתות ובאופן בלתי הפיך לגמרי כל שינוי שביצעו אנשים אחרים על אותו branch בדיוק, בלי שום אפשרות אמיתית לשחזור מהרפלוג המקומי",
      "force-push חסום מטבעו ומובנה לחלוטין ברמת הפרוטוקול הבסיסי של Git עבור branches משותפים בין כמה אנשים בו-זמנית, ולכן זה לא יכול היה לקרות בפועל כלל",
      "הקונפליקטים המוזרים שהתגלו נגרמו כתוצאה ישירה מבעיה זמנית ברשת בדיוק ובמקרה בזמן פעולת ה-pull הרגילה, ולא קשורים בכלל לשום פעולה שבוצעה ב-Git עצמו",
    ],
  },
  {
    story:
      "מאיה עשתה interactive rebase (rebase -i) על branch בשם feature/reports כדי לנקות את היסטוריית ה-commits לפני PR, " +
      "ובטעות סימנה commit אחד כ-\"squash\" לתוך הקודם לו במקום \"pick\". אחרי שדחפה (force-push) את השינוי, אחד מהתיקונים שלה — שהיה בתוך אותו commit שסומן ל-squash — נראה כאילו נעלם מהקוד, למרות שההודעה שלו עדיין מופיעה בהיסטוריה הממוזגת.",
    correct: "ה-squash מיזג את שינויי הקוד של שני ה-commits לכדי אחד; אם חלק מהשינוי נדרס (למשל conflict שנפתר לא נכון בזמן ה-squash), הקוד נעלם גם אם הודעת ה-commit נשמרה",
    wrong: [
      "squash תמיד מוחק לחלוטין ובאופן בלתי הפיך את הודעת ה-commit יחד עם כל הקוד שהיה בתוכו, ולכן שניהם היו אמורים להיעלם יחד מההיסטוריה",
      "force-push אחרי interactive rebase (rebase -i) הוא בהחלט פעולה בלתי אפשרית טכנית ולחלוטין ב-Git כברירת מחדל בכל מצב אפשרי, ולכן זה לא יכול היה בשום אופן לקרות בפועל כלל",
      "התיקון נעלם מהקוד כי פעולת rebase מוחקת אוטומטית כל קובץ שלא נגעו בו במפורש כבר ב-commit הראשון והמקורי של אותו branch",
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
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(difficulty === 2 ? CASES_MODERATE : CASES_HARD);
    const prompt = `${c.story}\n\nמה קרה כאן, בסבירות הגבוהה ביותר?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
