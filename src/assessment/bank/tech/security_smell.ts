// tech.security_smell — ASSESSMENT_DESIGN.md §3.4. 4 practices, one
// dangerous (key in frontend, shared admin account, open bucket, no MFA on root).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

interface Practice {
  text: string;
  dangerous: boolean;
}

const POOL: Practice[] = [
  { text: "מפתח API סודי מוטמע ישירות בקוד ה-frontend שרץ בדפדפן", dangerous: true },
  { text: "חשבון מנהל אחד (\"admin\") שכל הצוות משתמש בו במקום חשבונות אישיים", dangerous: true },
  { text: "דלי אחסון (storage bucket) עם קבצי לקוחות שמוגדר כציבורי (public)", dangerous: true },
  { text: "חשבון ה-root של ספק הענן ללא אימות דו-שלבי (MFA)", dangerous: true },
  { text: "כל מפתח בצוות משתמש בחשבון אישי משלו עם הרשאות מותאמות לתפקיד", dangerous: false },
  { text: "סודות (secrets) נשמרים במנהל סודות ייעודי (secrets manager) ולא בקוד", dangerous: false },
  { text: "דלי אחסון עם קבצי לקוחות שמוגדר כפרטי, וגישה רק דרך קישורים חתומים וזמניים", dangerous: false },
  { text: "חשבון ה-root מוגן ב-MFA ומשמש רק למקרי חירום, כשהעבודה השוטפת דרך חשבונות משנה", dangerous: false },
];

export const template: ItemTemplate = {
  id: "tech.security_smell",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const dangerous = rng.pick(POOL.filter((p) => p.dangerous));
    const safe = rng.sample(
      POOL.filter((p) => !p.dangerous),
      3,
    );

    const prompt = "מבין ארבע הפרקטיקות הבאות, שלוש בטוחות ואחת מסוכנת. איזו מהן מסוכנת?";
    const tagged = rng.shuffle([
      { text: dangerous.text, correct: true },
      ...safe.map((p) => ({ text: p.text, correct: false })),
    ]);
    const correctIndex = tagged.findIndex((o) => o.correct);

    return {
      content: { prompt, options: tagged.map((o) => o.text) },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
