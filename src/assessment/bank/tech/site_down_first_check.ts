// tech.site_down_first_check — ASSESSMENT_DESIGN.md §3.4. Symptom set
// (DNS/TLS/5xx/timeout) -> the first cheap check.
//
// d1 symptoms map almost directly onto their check (a cert error -> check
// the cert). d2 symptoms require isolating WHICH layer/subsystem is
// actually failing from a partial or indirect clue (a gateway timeout
// implies checking the upstream, not the gateway itself; images failing
// but pages loading implies checking storage/CDN permissions, not the app
// server) before the obvious-sounding "restart/check DNS" options apply.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  symptom: string;
  correct: string;
  wrong: string[];
}

const CASES_EASY: Case[] = [
  {
    symptom: "האתר לא נטען בדפדפן שלכם, אבל עמיתים אחרים מדווחים שהוא עובד להם כרגיל",
    correct: "לבדוק אם האתר עולה מרשת אחרת (למשל נתונים סלולריים) לפני שמניחים שהשרת נפל",
    wrong: [
      "להפעיל מחדש את השרת מיד",
      "לפתוח קריאת שירות דחופה לצוות התשתיות",
      "לבדוק את תעודת ה-TLS של האתר",
    ],
  },
  {
    symptom: "הדפדפן מציג שגיאת תעודת אבטחה (certificate) באתר",
    correct: "לבדוק את תוקף תעודת ה-TLS ולמי היא שייכת (expiry, common name)",
    wrong: [
      "לבדוק את רשומות ה-DNS של הדומיין",
      "להפעיל מחדש את השרת",
      "לבדוק את זמן התגובה (latency) של השרת",
    ],
  },
];

const CASES_HARD: Case[] = [
  {
    symptom: "כל הבקשות ל-API מחזירות 504 Gateway Timeout",
    correct: "לבדוק אם השרת שמאחורי ה-gateway (upstream) מגיב בכלל ותוך כמה זמן",
    wrong: [
      "לבדוק את תעודת ה-TLS",
      "לבדוק את רשומות ה-DNS",
      "לנקות את המטמון (cache) של הדפדפן",
    ],
  },
  {
    symptom: "אתר חדש שהועלה היום לא עולה בכלל, גם לא מהטלפון, וגם לא לחברים",
    correct: "לבדוק שרשומת ה-DNS של הדומיין אכן מצביעה לשרת הנכון",
    wrong: [
      "לבדוק את תעודת ה-TLS בלבד",
      "להפעיל מחדש את הדפדפן",
      "לבדוק את זמן התגובה של מסד הנתונים",
    ],
  },
  {
    symptom: "דף הבית של האתר עולה כרגיל, אבל כל תמונות המוצרים באתר מחזירות 403 Forbidden",
    correct: "לבדוק את הרשאות הגישה (public-read) של דלי האחסון/ה-CDN שמגיש את התמונות — האתר עצמו עובד",
    wrong: [
      "להפעיל מחדש את שרת האפליקציה",
      "לבדוק את רשומות ה-DNS של הדומיין",
      "לבדוק את תעודת ה-TLS של האתר",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.site_down_first_check",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(difficulty === 1 ? CASES_EASY : CASES_HARD);
    const prompt = `${c.symptom}\n\nמה הבדיקה הראשונה והזולה ביותר שכדאי לעשות?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
