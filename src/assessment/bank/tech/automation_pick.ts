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
      "no-code flow חד-פעמי בלי תזמון, שמישהו יפעיל ידנית בכל בוקר כשהוא נזכר",
      "פיצ'ר מובנה של המערכת, אם קיים כזה, גם בלי לבדוק אם הוא באמת קיים",
      "להשאיר את זה ידני — זה מהיר מדי בכל פעם בשביל להצדיק השקעה באוטומציה",
    ],
  },
  {
    task: "כל יום מישהו מעתיק ידנית עשרות שורות חדשות מגיליון Google Sheets אחד לגיליון אחר, לפי אותו כלל קבוע, בערך באותה שעה",
    correct: "סקריפט מתוזמן (scheduled script) שמעתיק את השורות החדשות אוטומטית כל יום",
    wrong: [
      "לבנות שירות backend מלא עם מסד נתונים משלו רק לצורך העתקה בין שני גיליונות",
      "להשאיר את זה ידני כי מדובר ב\"רק העתק-הדבק\" שלוקח כמה דקות בכל פעם",
      "לבקש מכל אחד בצוות להעתיק את השורות לגיליון שלו בנפרד, בלי תיאום ביניהם",
    ],
  },
];

const CASES_MODERATE: Case[] = [
  {
    task: "פעם בשנה צריך להעביר נתונים בין שתי מערכות בתהליך חד-פעמי ומורכב",
    correct: "לא שווה להשקיע באוטומציה מלאה — סקריפט חד-פעמי או תהליך ידני מבוקר מספיקים",
    wrong: [
      "לבנות pipeline אוטומציה מלא שרץ כל יום, כדי שיהיה מוכן כשהתהליך השנתי יחזור",
      "no-code flow שרץ כל שעה כדי לוודא שהנתונים בין המערכות תמיד מסונכרנים",
      "פיצ'ר מובנה שדורש רכישת מודול חדש בתשלום נוסף, כדי לתמוך בתהליך החד-פעמי הזה",
    ],
  },
  {
    task: "צוות המכירות רוצה שכל טופס חדש שמתקבל יעדכן אוטומטית גיליון Google Sheets, בלי צורך בקוד",
    correct: "no-code automation flow (למשל חיבור בין הטופס לגיליון) — מתאים כשאין צורך בלוגיקה מורכבת ואין למי לתחזק קוד",
    wrong: [
      "לכתוב שירות backend מלא ומורכב לצורך זה, כדי שתהיה שליטה מלאה ומוחלטת בקוד ובלוגיקה העתידית שלו",
      "להשאיר תהליך ידני קבוע של העתקה עבור כל טופס חדש שמתקבל לגיליון, כי מדובר כרגע בכמות קטנה יחסית של טפסים",
      "סקריפט מתוזמן שרץ אוטומטית פעם בשבוע במקום באופן מיידי לגמרי, כדי לחסוך בעומס הכללי על השרת",
    ],
  },
  {
    task: "המערכת שבה עובדים כבר תומכת רשמית ב\"ייצוא אוטומטי מתוזמן\" בדיוק לצורך הזה, אבל אף אחד לא בדק את זה",
    correct: "לבדוק ולהפעיל את הפיצ'ר המובנה הקיים במערכת לפני שבונים פתרון חיצוני",
    wrong: [
      "לכתוב סקריפט חיצוני שעושה בדיוק אותו דבר, בלי לבדוק קודם את הפיצ'ר הקיים",
      "לבנות no-code flow חדש שמחבר בין המערכות, במקום להפעיל את מה שכבר קיים",
      "להמשיך לעשות את זה ידנית כי זה עובד כבר תקופה ארוכה בלי תקלות",
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
