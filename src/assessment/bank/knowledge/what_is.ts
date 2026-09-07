// knowledge.what_is — "מה זה X?" over general technology vocabulary.
// ASSESSMENT_DESIGN.md §3.5. Terms are deliberately *general*: things anyone
// genuinely curious about technology picks up, not things you only meet in a
// particular job or course. That is the line this family walks — measure
// exposure to the field, not exposure to one employer's stack.
import { defineTermTemplate, type TermEntry } from "./helpers";

const POOL: readonly TermEntry[] = [
  { term: "DNS", meaning: "מתרגם שם של אתר לכתובת IP" },
  { term: "API", meaning: "ממשק שמאפשר לתוכנות לדבר זו עם זו" },
  { term: "cache", meaning: "שמירה זמנית של מידע כדי להאיץ גישה חוזרת אליו" },
  { term: "VPN", meaning: "חיבור מוצפן שמעביר את התעבורה דרך רשת אחרת" },
  { term: "firewall", meaning: "מסנן תעבורת רשת ומחליט מה מותר להיכנס ולצאת" },
  { term: "backup", meaning: "עותק של נתונים שנשמר כדי לשחזר אותם אם המקור נפגע" },
  { term: "SaaS", meaning: "תוכנה שנצרכת כשירות בענן במקום להתקין אותה מקומית" },
  { term: "server", meaning: "מחשב שמספק שירות או נתונים למחשבים אחרים" },
  { term: "database", meaning: "מערכת לאחסון נתונים מסודרים ולשליפה שלהם" },
  { term: "cookie", meaning: "קובץ קטן שהאתר שומר בדפדפן כדי לזכור מידע על המשתמש" },
  { term: "SSL / TLS", meaning: "הצפנה של התקשורת בין הדפדפן לשרת" },
  { term: "load balancer", meaning: "מפזר בקשות נכנסות בין כמה שרתים" },
  { term: "webhook", meaning: "קריאה שהמערכת השולחת אוטומטית כשקורה אירוע" },
  { term: "repository", meaning: "מאגר שמכיל את קוד הפרויקט ואת היסטוריית השינויים שלו" },
  { term: "log", meaning: "רישום כרונולוגי של מה שקרה במערכת" },
  { term: "IP address", meaning: "מזהה מספרי של מכשיר ברשת" },
  { term: "domain", meaning: "השם שרוכשים לאתר, כמו example.co.il" },
  { term: "downtime", meaning: "פרק זמן שבו השירות לא זמין למשתמשים" },
  { term: "encryption", meaning: "הפיכת מידע לבלתי קריא למי שאין לו את המפתח" },
  { term: "open source", meaning: "תוכנה שהקוד שלה פתוח לצפייה ולשימוש" },
  { term: "bug", meaning: "תקלה בקוד שגורמת להתנהגות לא נכונה" },
  { term: "deploy", meaning: "העלאה של גרסה חדשה של המערכת לסביבה פעילה" },
  { term: "queue", meaning: "תור שבו משימות ממתינות לעיבוד לפי הסדר" },
  { term: "uptime", meaning: "אחוז הזמן שבו השירות היה זמין" },
];

export const template = defineTermTemplate({
  id: "knowledge.what_is",
  ask: (term) => `מה זה \`${term}\`?`,
  pool: POOL,
});
