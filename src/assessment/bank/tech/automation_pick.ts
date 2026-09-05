// tech.automation_pick — ASSESSMENT_DESIGN.md §3.4. Repetitive manual task
// -> most appropriate automation shape.
//
// d1 uses the one case with an unambiguous "obviously worth automating,
// obvious shape" answer. d2's three cases each require resisting a
// tempting-but-wrong instinct (over-automating a one-off; picking a
// heavier build than a no-code flow needs; reinventing a feature that
// already exists) rather than a straight pattern match.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  task: string;
  correct: string;
  wrong: string[];
}

const CASES_EASY: Case[] = [
  {
    task: "כל בוקר מישהו מוריד ידנית קובץ CSV ממערכת אחת ומעלה אותו למערכת אחרת, כל יום באותה שעה",
    correct: "סקריפט מתוזמן (scheduled script) שמריץ את ההעברה אוטומטית כל בוקר",
    wrong: [
      "no-code flow חד-פעמי בלי תזמון",
      "פיצ'ר מובנה של המערכת (אם קיים כבר ולא נבדק)",
      "להשאיר את זה ידני — זה מהיר מדי בשביל להצדיק אוטומציה",
    ],
  },
  {
    task: "כל יום מישהו מעתיק ידנית עשרות שורות חדשות מגיליון Google Sheets אחד לגיליון אחר, לפי אותו כלל קבוע, בערך באותה שעה",
    correct: "סקריפט מתוזמן (scheduled script) שמעתיק את השורות החדשות אוטומטית כל יום",
    wrong: [
      "לבנות שירות backend מלא לצורך העתקה בין שני גיליונות",
      "להשאיר את זה ידני כי מדובר ב\"רק העתק-הדבק\"",
      "לבקש מכל אחד בצוות להעתיק לגיליון שלו בנפרד",
    ],
  },
];

const CASES_MODERATE: Case[] = [
  {
    task: "פעם בשנה צריך להעביר נתונים בין שתי מערכות בתהליך חד-פעמי ומורכב",
    correct: "לא שווה להשקיע באוטומציה מלאה — סקריפט חד-פעמי או תהליך ידני מבוקר מספיקים",
    wrong: [
      "לבנות pipeline אוטומציה מלא שרץ כל יום",
      "no-code flow שרץ כל שעה",
      "פיצ'ר מובנה שדורש רכישת מודול חדש",
    ],
  },
  {
    task: "צוות המכירות רוצה שכל טופס חדש שמתקבל יעדכן אוטומטית גיליון Google Sheets, בלי צורך בקוד",
    correct: "no-code automation flow (למשל חיבור בין הטופס לגיליון) — מתאים כשאין צורך בלוגיקה מורכבת ואין למי לתחזק קוד",
    wrong: [
      "לכתוב שירות backend מלא לצורך זה",
      "להשאיר תהליך ידני של העתקה",
      "סקריפט מתוזמן שרץ פעם בשבוע במקום מיידית",
    ],
  },
  {
    task: "המערכת שבה עובדים כבר תומכת רשמית ב\"ייצוא אוטומטי מתוזמן\" בדיוק לצורך הזה, אבל אף אחד לא בדק את זה",
    correct: "לבדוק ולהפעיל את הפיצ'ר המובנה הקיים במערכת לפני שבונים פתרון חיצוני",
    wrong: [
      "לכתוב סקריפט חיצוני שעושה בדיוק אותו דבר",
      "לבנות no-code flow חדש",
      "להמשיך לעשות את זה ידנית כי זה עובד",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.automation_pick",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(difficulty === 1 ? CASES_EASY : CASES_MODERATE);
    const prompt = `${c.task}\n\nמה צורת האוטומציה המתאימה ביותר (אם בכלל)?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
