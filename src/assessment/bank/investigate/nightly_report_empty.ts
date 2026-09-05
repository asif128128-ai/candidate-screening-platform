// investigate.nightly_report_empty — ASSESSMENT_DESIGN.md §3.3. Nightly
// report has been empty for 3 days.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "הדוח היומי ריק כבר 3 ימים. אין שגיאה גלויה, פשוט 0 שורות."';

function buildA(rng: Rng): VariantWorld {
  const cronHour = rng.pick([23, 22]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "cron",
        label: "הגדרת cron",
        body: `תזמון: ${cronHour}:00 UTC כל יום\nשאילתה: SELECT * FROM events WHERE event_date = CURRENT_DATE`,
      },
      {
        key: "data",
        label: "דוגמת שורות מקור",
        body: `נתונים בטבלה כוללים חותמות זמן לפי שעון ישראל (UTC+3 בקיץ). השורות האחרונות: 2026-09-04 00:15, 2026-09-04 01:02, 2026-09-04 02:40`,
      },
      {
        key: "joblog",
        label: "לוג הרצת הדוח",
        body: "query returned 0 rows, 3 nights in a row",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "רועי: שדרגנו את גרסת הספרייה של ה-PDF export השבוע, נראה תקין.",
      },
    ],
    decisiveArtifactKeyQ1: "data",
    decisiveArtifactKeyQ3: "cron",
    q1Options: [
      { text: "טבלת המקור שונתה שם" },
      { text: "ה-API של המקור החזיר עמוד אחד בלבד" },
      {
        text: `ה-cron רץ ב-${cronHour}:00 UTC (לפני חצות בישראל), ומחפש CURRENT_DATE לפי UTC — בזמן שהנתונים עצמם נכתבים לפי שעון ישראל, כך שהיום עדיין לא התחיל מבחינת ה-UTC כשהשאילתה רצה`,
        correct: true,
      },
      { text: "שדרוג ספריית ה-PDF שבר את הדוח" },
    ],
    q3Prompt: "באיזו שעה (UTC) מתוזמן ה-cron לרוץ?",
    q3Fact: `${cronHour}:00`,
    correctActionText: "לתקן את השאילתה כך שתשתמש בטווח התאריכים לפי שעון ישראל ולא לפי UTC, ולוודא שהדוח הבא מכיל שורות",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הגדרת ה-cron ולבנות אחת חדשה מאפס",
      treat_symptom: "להריץ את הדוח ידנית כל לילה במקום לתקן",
      fix_decoy: "לבדוק את שדרוג ספריית ה-PDF",
      busywork_gather_more: "לאסוף את כל הרצות הדוח מהשנה האחרונה לפני שנוגעים בקוד",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const oldTable = "raw_events";
  const newTable = rng.pick(["events_v2", "activity_events"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "sql",
        label: "שאילתת הדוח",
        body: `SELECT * FROM ${oldTable} WHERE event_date = CURRENT_DATE`,
      },
      {
        key: "schema",
        label: "יומן שינויי סכימה",
        body: `לפני 4 ימים: הטבלה ${oldTable} שונתה שם ל-${newTable} כחלק מניקוי סכימה. נוצר view זמני בשם ${oldTable} שמצביע ל-${newTable}_legacy (ריק).`,
      },
      {
        key: "joblog",
        label: "לוג הרצת הדוח",
        body: "0 rows returned, 3 nights in a row, no error thrown",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "הילה: יש לנו רעש רשת מוזר בין השרתים, בודקת.",
      },
    ],
    decisiveArtifactKeyQ1: "schema",
    decisiveArtifactKeyQ3: "schema",
    q1Options: [
      { text: "ה-cron רץ בשעה הלא נכונה" },
      {
        text: `הטבלה ${oldTable} שונתה שם ל-${newTable}; ה-view הזמני שנשאר בשם הישן מצביע לטבלה ריקה (legacy) ולא לנתונים האמיתיים`,
        correct: true,
      },
      { text: "יש בעיית רשת בין השרתים" },
      { text: "ה-API של המקור מחזיר עמוד אחד בלבד" },
    ],
    q3Prompt: "מה השם החדש של הטבלה (אחרי שינוי השם)?",
    q3Fact: newTable,
    correctActionText: `לעדכן את שאילתת הדוח כך שתפנה ישירות ל-${newTable}, ולוודא שהדוח הבא מכיל שורות`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את ה-view הזמני מיד בלי לבדוק מה תלוי בו",
      treat_symptom: "למלא את הדוח ידנית ממקור אחר",
      fix_decoy: "לחקור את רעש הרשת בין השרתים",
      busywork_gather_more: "לעבור על כל שינויי הסכימה של השנה האחרונה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const pageSize = rng.pick([100, 200]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "api",
        label: "קוד משיכת הנתונים (מקוצר)",
        body: `response = api.get('/events?date=today')\nrows = response.data  # לוקח רק את העמוד הראשון`,
      },
      {
        key: "docs",
        label: "תיעוד ה-API החיצוני",
        body: `מתוך התיעוד: "התשובה מוגבלת ל-${pageSize} רשומות בעמוד. יש להשתמש בפרמטר next_page_token כדי לקבל עמודים נוספים. שינוי מהשבוע שעבר: העמוד הראשון עשוי כעת להיות ריק אם אין רשומות חדשות מאז חצות בדיוק."`,
      },
      {
        key: "joblog",
        label: "לוג הרצת הדוח",
        body: "GET /events?date=today -> 0 records on page 1, job exits immediately",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "עידו: שמנו לב לעלייה קלה בעלויות הענן החודש, לא דחוף.",
      },
    ],
    decisiveArtifactKeyQ1: "docs",
    decisiveArtifactKeyQ3: "docs",
    q1Options: [
      { text: "ה-cron מוגדר בשעה הלא נכונה" },
      { text: "טבלת המקור שונתה שם" },
      {
        text: "הקוד קורא רק את העמוד הראשון של ה-API; מאז שינוי בהתנהגות הספק, העמוד הראשון יכול להיות ריק והמשך הנתונים נמצא בעמודים הבאים (next_page_token)",
        correct: true,
      },
      { text: "עלות הענן שעלתה מצביעה על עומס שחוסם את הבקשה" },
    ],
    q3Prompt: "מה שם הפרמטר שצריך להשתמש בו כדי לקבל את העמודים הבאים?",
    q3Fact: "next_page_token",
    correctActionText: "לתקן את הקוד כך שיעבור על כל העמודים דרך next_page_token עד שאין עוד עמודים, ולוודא שהדוח הבא מכיל שורות",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את השימוש ב-API הזה ולבנות מקור נתונים חדש",
      treat_symptom: "להריץ את הדוח שוב ושוב ידנית עד שמתקבלות שורות",
      fix_decoy: "לבדוק את עליית עלות הענן",
      busywork_gather_more: "לקרוא את כל תיעוד ה-API מההתחלה לפני שנוגעים בקוד",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.nightly_report_empty",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
