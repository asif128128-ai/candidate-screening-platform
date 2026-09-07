// knowledge.tool_purpose — what a widely-used tool is for.
// ASSESSMENT_DESIGN.md §3.5. Tools chosen for breadth across the role's
// surface (code, data, cloud, ops, collaboration) rather than depth in any
// one of them.
import { defineTermTemplate, type TermEntry } from "./helpers";

const POOL: readonly TermEntry[] = [
  { term: "Git", meaning: "ניהול גרסאות של קוד ומעקב אחרי שינויים" },
  { term: "Docker", meaning: "אריזה של אפליקציה עם כל התלויות שלה לקונטיינר" },
  { term: "PostgreSQL", meaning: "מסד נתונים רלציוני" },
  { term: "Excel", meaning: "גיליונות אלקטרוניים, חישובים וניתוח נתונים" },
  { term: "Jira", meaning: "ניהול משימות ותקלות של צוותי פיתוח" },
  { term: "Grafana", meaning: "הצגת מדדים וגרפים של מערכות בזמן אמת" },
  { term: "Zapier", meaning: "חיבור אוטומציות בין מערכות בלי לכתוב קוד" },
  { term: "Postman", meaning: "שליחת בקשות ל-API ובדיקת התשובות" },
  { term: "Terraform", meaning: "הגדרת תשתית ענן כקוד" },
  { term: "Slack", meaning: "תקשורת בצוות בערוצים ובהודעות" },
];

export const template = defineTermTemplate({
  id: "knowledge.tool_purpose",
  ask: (term) => `למה משמש \`${term}\`?`,
  pool: POOL,
});
