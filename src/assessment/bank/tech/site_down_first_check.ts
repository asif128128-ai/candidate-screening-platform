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
      "להפעיל מחדש את השרת מיד, כי סביר שמדובר בתקלה זמנית בתהליך שדורשת אתחול מלא",
      "לפתוח קריאת שירות דחופה לצוות התשתיות, כדי שיבדקו את זמינות השרת מול המפקח",
      "לבדוק את תעודת ה-TLS של האתר, כי שגיאת אבטחה בדפדפן היא הסיבה הנפוצה ביותר לכך",
    ],
  },
  {
    symptom: "הדפדפן מציג שגיאת תעודת אבטחה (certificate) באתר",
    correct: "לבדוק את תוקף תעודת ה-TLS ולמי היא שייכת (expiry, common name)",
    wrong: [
      "לבדוק את רשומות ה-DNS של הדומיין, כי הפניה שגויה לשרת אחר היא הגורם הנפוץ לשגיאת אבטחה כזו",
      "להפעיל מחדש את השרת, כי לרוב שגיאת אבטחה בדפדפן נובעת מתהליך תקוע שדורש אתחול",
      "לבדוק את זמן התגובה (latency) של השרת, כי עומס גבוה עלול לגרום לשגיאת אבטחה בדפדפן",
    ],
  },
];

const CASES_HARD: Case[] = [
  {
    symptom: "כל הבקשות ל-API מחזירות 504 Gateway Timeout",
    correct: "לבדוק אם השרת שמאחורי ה-gateway (upstream) מגיב בכלל ותוך כמה זמן",
    wrong: [
      "לבדוק את תעודת ה-TLS של ה-gateway, כי שגיאת timeout לעיתים מוסתרת מאחורי כשל באימות",
      "לבדוק את רשומות ה-DNS של הדומיין, כי הפניה שגויה עלולה לגרום לתשובת timeout מה-gateway",
      "לנקות את המטמון (cache) של הדפדפן אצל כל המשתמשים שמדווחים על שגיאת ה-timeout",
    ],
  },
  {
    symptom: "אתר חדש שהועלה היום לא עולה בכלל, גם לא מהטלפון, וגם לא לחברים",
    correct: "לבדוק שרשומת ה-DNS של הדומיין אכן מצביעה לשרת הנכון",
    wrong: [
      "לבדוק את תעודת ה-TLS בלבד, כי אתר חדש שהועלה היום לרוב נכשל בגלל תעודה שטרם הונפקה",
      "להפעיל מחדש את הדפדפן בכל המכשירים שמנסים לגשת לאתר החדש שהועלה היום",
      "לבדוק את זמן התגובה של מסד הנתונים, כי עומס בטעינה הראשונית עלול למנוע מהאתר לעלות",
    ],
  },
  {
    symptom: "דף הבית של האתר עולה כרגיל, אבל כל תמונות המוצרים באתר מחזירות 403 Forbidden",
    correct: "לבדוק את הרשאות הגישה (public-read) של דלי האחסון/ה-CDN שמגיש את התמונות — האתר עצמו עובד",
    wrong: [
      "להפעיל מחדש את שרת האפליקציה, כי כשל בטעינת תמונות בדרך כלל מקורו בתהליך שרת שנתקע",
      "לבדוק את רשומות ה-DNS של הדומיין הראשי, כי הפניה שגויה עלולה לחסום רק את התמונות",
      "לבדוק את תעודת ה-TLS של האתר, כי תעודה שפגה חלקית עלולה לחסום דווקא נכסים סטטיים",
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
