// tech.http_status_next — ASSESSMENT_DESIGN.md §3.4 worked example 8. API
// response + the provider's doc excerpt for that status -> correct next
// action (reasoning with the stated semantics, per DECISIONS_LOG.md #8).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface StatusDef {
  code: number;
  title: string;
  body: string;
  docExcerpt: string;
  correct: string;
  wrong: string[];
}

const STATUSES: StatusDef[] = [
  {
    code: 429,
    title: "Too Many Requests",
    body: '{"error":"rate_limited","limit":"1000/hour","reset":"2026-09-04T15:00:00Z"}',
    docExcerpt:
      'מתוך התיעוד של הספק: "קוד 429 מוחזר כשחשבון חרג ממכסת הבקשות. Retry-After הוא מספר השניות עד שאפשר לנסות שוב. המכסה משותפת לכל המפתחות של אותו חשבון."',
    correct: "לכבד את Retry-After, להוסיף backoff, ולבדוק אם יש תהליך נוסף שצורך את אותה מכסה",
    wrong: [
      "להריץ את הסקריפט מחדש מיד, כנראה תקלה זמנית",
      "לבקש מהספק מפתח API נוסף ולפצל את הבקשות",
      "לעבור ל-polling תדיר יותר כדי לפצות על הבקשות שנכשלו",
    ],
  },
  {
    code: 401,
    title: "Unauthorized",
    body: '{"error":"invalid_token"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 401 מוחזר כשה-access token פג תוקף או שגוי. יש להשתמש ב-refresh token כדי לקבל access token חדש; אין צורך להתחבר מחדש מהתחלה."',
    correct: "להשתמש ב-refresh token כדי לקבל access token חדש ולנסות שוב",
    wrong: [
      "לבקש מהמשתמש להתחבר מחדש מאפס בכל פעם",
      "להתעלם מהשגיאה ולנסות שוב באותו token",
      "לשנות את כתובת ה-API",
    ],
  },
  {
    code: 503,
    title: "Service Unavailable",
    body: '{"error":"maintenance"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 503 מוחזר בזמן תחזוקה מתוכננת של השירות. Retry-After מציין מתי לנסות שוב. בקשות במהלך תחזוקה לא מתבצעות ולא נשמרות."',
    correct: "להמתין לפי Retry-After ואז לנסות שוב, ולוודא שהבקשה אכן לא בוצעה",
    wrong: [
      "לנסות שוב מיד בלולאה עד שזה עובד",
      "להניח שהבקשה בוצעה בהצלחה ולהמשיך הלאה",
      "לפתוח פנייה לתמיכה במקום לחכות",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.http_status_next",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "התיעוד של הספק לגבי קוד הסטטוס הרלוונטי מובא במלואו בתוך הפריט.",
  generate(rng: Rng) {
    const def = rng.pick(STATUSES);
    const prompt =
      `סקריפט סנכרון שרץ כל שעה מתחיל לקבל מה-API של ספק SaaS את התשובה:\n\n` +
      `\`\`\`\nHTTP/1.1 ${def.code} ${def.title}\n${def.body}\n\`\`\`\n\n` +
      `${def.docExcerpt}\n\nמה הפעולה הנכונה?`;

    const { options, correctIndex } = shuffleOptions(rng, def.correct, def.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
      conventionsStated: def.docExcerpt,
    };
  },
};
