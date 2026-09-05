// tech.http_status_next — ASSESSMENT_DESIGN.md §3.4 worked example 8. API
// response + the provider's doc excerpt for that status -> correct next
// action (reasoning with the stated semantics, per DECISIONS_LOG.md #8).
//
// Difficulty scales via which status codes are in the pool: d1/d2 use
// well-known codes whose doc excerpt maps almost directly onto the correct
// action; d3 uses less common codes where the doc excerpt's semantics
// actively contradict the tempting-but-wrong "just retry" instinct, so the
// candidate must reason from the stated rule rather than pattern-match a
// familiar code.
import type { Difficulty, ItemTemplate } from "../../types";
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

const STATUSES_EASY: StatusDef[] = [
  {
    code: 429,
    title: "Too Many Requests",
    body: '{"error":"rate_limited","limit":"1000/hour","reset":"2026-09-04T15:00:00Z"}',
    docExcerpt:
      'מתוך התיעוד של הספק: "קוד 429 מוחזר כשחשבון חרג ממכסת הבקשות. Retry-After הוא מספר השניות עד שאפשר לנסות שוב. המכסה משותפת לכל המפתחות של אותו חשבון."',
    correct: "לכבד את Retry-After, להוסיף backoff, ולבדוק אם יש תהליך נוסף שצורך את אותה מכסה",
    wrong: [
      "להריץ את הסקריפט מחדש מיד בלי להמתין כלל, כי סביר שמדובר בתקלת רשת זמנית ולא במכסה",
      "לבקש מהספק מפתח API נוסף ולפצל את הבקשות בין שני המפתחות השונים כדי לעקוף את המגבלה הקיימת",
      "לעבור ל-polling תדיר הרבה יותר כדי לפצות על הבקשות שנכשלו ולוודא שכלום לא מתפספס בדרך",
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
      "לבקש מהמשתמש להתחבר מחדש מאפס בכל פעם שה-access token פג, במקום להשתמש ב-refresh token",
      "להתעלם מהשגיאה ולנסות לשלוח שוב את אותה בקשה עם אותו access token שכבר פג תוקף",
      "לשנות את כתובת ה-API לכתובת חלופית, כי כנראה מדובר בבעיה בשרת ולא בטוקן עצמו",
    ],
  },
];

// d2: still a common code, but the correct action requires noticing a
// second detail beyond "wait and retry" (did the request actually happen /
// does the body need to change, not just the timing).
const STATUSES_MODERATE: StatusDef[] = [
  {
    code: 503,
    title: "Service Unavailable",
    body: '{"error":"maintenance"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 503 מוחזר בזמן תחזוקה מתוכננת של השירות. Retry-After מציין מתי לנסות שוב. בקשות במהלך תחזוקה לא מתבצעות ולא נשמרות."',
    correct: "להמתין לפי Retry-After ואז לנסות שוב, ולוודא שהבקשה אכן לא בוצעה",
    wrong: [
      "לנסות שוב מיד בלולאה הדוקה עד שזה עובד, בלי להמתין לזמן שצוין ב-Retry-After",
      "להניח שהבקשה בוצעה בהצלחה ולהמשיך הלאה, כי תחזוקה מתוכננת בדרך כלל לא משפיעה על נתונים",
      "לפתוח פנייה לתמיכה של הספק במקום להמתין לזמן החזרה שכבר מצוין בתגובה עצמה",
    ],
  },
  {
    code: 400,
    title: "Bad Request",
    body: '{"error":"validation_error","field":"email"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 400 מוחזר כשגוף הבקשה לא עומד בסכימה (validation). השדה השגוי מצוין ב-field. שליחה חוזרת של אותו גוף בקשה תחזיר את אותה שגיאה."',
    correct: "לתקן את גוף הבקשה לפי השדה שצוין (email) לפני שליחה חוזרת — ניסיון חוזר עם אותו payload לא יעזור",
    wrong: [
      "לנסות שוב מיד עם אותו payload בדיוק ובלי לשנות שום דבר, כי לעיתים שגיאות ולידציה הן זמניות וחולפות מעצמן",
      "להוסיף backoff ולנסות שוב מאוחר יותר בלי לשנות שום דבר כלל בגוף הבקשה שכבר נשלח בפעם הקודמת",
      "לפנות לתמיכה הטכנית של הספק כדי שיתקנו את הבקשה בעצמם בצד שלהם, במקום לתקן את השדה השגוי בעצמנו",
    ],
  },
];

// d3: less common codes whose doc excerpt directly contradicts the
// tempting "it's a 2xx / just retry" instinct — genuinely requires reading
// the stated rule, not recognizing a familiar code.
const STATUSES_HARD: StatusDef[] = [
  {
    code: 202,
    title: "Accepted",
    body: '{"job_id":"job_8841","status":"queued"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 202 מציין שהבקשה התקבלה לעיבוד אסינכרוני אך טרם הושלמה. יש לבדוק את הסטטוס בכתובת GET /jobs/{job_id} עד שהוא הופך ל-done או failed. אין להניח הצלחה על סמך 202 בלבד."',
    correct: "לשמור את job_id ולבדוק (poll) את /jobs/{job_id} עד לסטטוס done/failed, ולא להניח שהפעולה הסתיימה",
    wrong: [
      "להניח שהבקשה הצליחה לגמרי ומיידית כי הקוד תקין (2xx), ולהמשיך הלאה בלי לבדוק שום סטטוס נוסף בכלל",
      "לשלוח את אותה בקשה בדיוק שוב מיד כדי לוודא ביתר ביטחון שהיא אכן מתבצעת ולא נתקעה בתור העיבוד",
      "להתעלם לגמרי מ-job_id שהתקבל ולבדוק את התוצאה מאוחר יותר דרך מסך כללי, בלי endpoint ייעודי כלשהו",
    ],
  },
  {
    code: 409,
    title: "Conflict",
    body: '{"error":"duplicate_request","existing_id":"ord_5521"}',
    docExcerpt:
      'מתוך התיעוד: "קוד 409 מוחזר כאשר מפתח האידמפוטנטיות (Idempotency-Key) שנשלח כבר שימש בעבר. הבקשה המקורית כבר בוצעה; existing_id מצביע על התוצאה הקיימת. אין ליצור בקשה חדשה עם אותה תוצאה."',
    correct: "להשתמש ב-existing_id כתוצאה הקיימת, ולא ליצור בקשה כפולה עם Idempotency-Key חדש",
    wrong: [
      "ליצור Idempotency-Key חדש לגמרי ולשלוח את הבקשה שוב, כדי לוודא שהפעם היא בהחלט כן תתבצע",
      "להתעלם לגמרי מ-existing_id שמופיע בתגובה ולהניח שהבקשה המקורית נכשלה כליל בצד השרת",
      "לפנות מיד לתמיכה של הספק כי מדובר כנראה בשגיאת שרת, במקום להשתמש ב-existing_id שכבר סופק",
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
  generate(rng: Rng, difficulty: Difficulty) {
    const pool = difficulty === 1 ? STATUSES_EASY : difficulty === 2 ? STATUSES_MODERATE : STATUSES_HARD;
    const def = rng.pick(pool);
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
