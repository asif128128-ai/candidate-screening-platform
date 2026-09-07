// knowledge.file_type — what a given file extension actually holds.
// ASSESSMENT_DESIGN.md §3.5. Directly relevant to the role: this person will
// be handed exports, configs and logs constantly and has to know what they are
// looking at before they can do anything useful with them.
import { defineTermTemplate, type TermEntry } from "./helpers";

const POOL: readonly TermEntry[] = [
  { term: ".csv", meaning: "טבלה כטקסט, שורה לכל רשומה וערכים מופרדים בפסיקים" },
  { term: ".json", meaning: "נתונים מובנים במבנה של מפתחות וערכים" },
  { term: ".env", meaning: "משתני סביבה והגדרות רגישות של האפליקציה" },
  { term: ".log", meaning: "רישום כרונולוגי של אירועים שהמערכת כתבה" },
  { term: ".sql", meaning: "שאילתות או פקודות למסד נתונים" },
  { term: ".zip", meaning: "אוסף קבצים דחוס לקובץ אחד" },
  { term: ".pdf", meaning: "מסמך לתצוגה והדפסה ששומר על העיצוב שלו" },
  { term: ".xlsx", meaning: "גיליון אלקטרוני עם נוסחאות וכמה לשוניות" },
];

export const template = defineTermTemplate({
  id: "knowledge.file_type",
  ask: (term) => `קיבלתם קובץ עם הסיומת \`${term}\`. מה הוא מכיל?`,
  pool: POOL,
});
