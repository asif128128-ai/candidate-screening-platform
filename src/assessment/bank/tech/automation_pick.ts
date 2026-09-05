// tech.automation_pick — ASSESSMENT_DESIGN.md §3.4. Repetitive manual task
// -> most appropriate automation shape.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  task: string;
  correct: string;
  wrong: string[];
}

const CASES: Case[] = [
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
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const prompt = `${c.task}\n\nמה צורת האוטומציה המתאימה ביותר (אם בכלל)?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
