// knowledge.command_purpose — what a basic command does.
// ASSESSMENT_DESIGN.md §3.5. Kept to the handful of commands that show up in
// any first week near a terminal or a repo — deliberately not flags, pipes or
// anything that rewards a specific course.
import { defineTermTemplate, type TermEntry } from "./helpers";

const POOL: readonly TermEntry[] = [
  { term: "git commit", meaning: "שומר את השינויים שהוכנו כנקודה בהיסטוריית הגרסאות" },
  { term: "git pull", meaning: "מושך למחשב את השינויים האחרונים מהמאגר המרוחק" },
  { term: "ls", meaning: "מציג את רשימת הקבצים בתיקייה הנוכחית" },
  { term: "cd", meaning: "מעביר אותך לתיקייה אחרת" },
  { term: "ping", meaning: "בודק אם כתובת ברשת מגיבה וכמה זמן לוקח לה" },
  { term: "grep", meaning: "מחפש שורות שמכילות טקסט מסוים" },
  { term: "curl", meaning: "שולח בקשת רשת לכתובת ומדפיס את התשובה" },
  { term: "chmod", meaning: "משנה את הרשאות הגישה לקובץ" },
];

export const template = defineTermTemplate({
  id: "knowledge.command_purpose",
  ask: (term) => `מה עושה הפקודה \`${term}\`?`,
  pool: POOL,
});
