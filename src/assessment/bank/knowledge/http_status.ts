// knowledge.http_status — what a common HTTP status code means.
// ASSESSMENT_DESIGN.md §3.5. Restricted to the codes anyone who has touched a
// browser's network tab or an API meets constantly; the deeper codes (429,
// 502 vs 504) stay in the tech block where the item states their semantics.
import { defineTermTemplate, type TermEntry } from "./helpers";

const POOL: readonly TermEntry[] = [
  { term: "200", meaning: "הבקשה הצליחה" },
  { term: "301", meaning: "הכתובת עברה לצמיתות לכתובת אחרת" },
  { term: "400", meaning: "הבקשה עצמה שגויה או חסרה שדות" },
  { term: "401", meaning: "לא בוצעה הזדהות — צריך להתחבר" },
  { term: "403", meaning: "מזוהה, אבל אין הרשאה לפעולה הזו" },
  { term: "404", meaning: "המשאב המבוקש לא נמצא" },
  { term: "500", meaning: "שגיאה בצד השרת" },
  { term: "503", meaning: "השירות אינו זמין כרגע" },
];

export const template = defineTermTemplate({
  id: "knowledge.http_status",
  ask: (term) => `בתשובה מהשרת התקבל הקוד \`${term}\`. מה המשמעות שלו?`,
  pool: POOL,
});
