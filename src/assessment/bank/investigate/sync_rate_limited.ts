// investigate.sync_rate_limited — ASSESSMENT_DESIGN.md §3.3. Data sync
// fails every afternoon.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "הסנכרון עם הספק נכשל כל יום אחר הצהריים, בערך באותה שעה."';

function buildA(rng: Rng): VariantWorld {
  const hour = rng.pick([14, 15]);
  const dailyLimit = rng.pick([5000, 10000]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "log",
        label: "לוג סנכרון",
        body: `${hour}:03  sync_job  429 quota_exceeded\n${hour}:33  sync_job  429 quota_exceeded\n09:00  sync_job  200 ok`,
      },
      {
        key: "limitsdoc",
        label: "תיעוד מגבלות API",
        body: `מתוך התיעוד: "מכסה יומית של ${dailyLimit} קריאות, משותפת לכל המפתחות (API keys) של אותו חשבון. המכסה מתאפסת בחצות UTC."`,
      },
      {
        key: "schedules",
        label: "לוח זמנים של עבודות (jobs)",
        body: `sync_job: רץ כל 30 דקות\nreport_job: רץ כל 10 דקות (נוסף לפני שבוע, משתמש באותו מפתח API)`,
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "דנה: שדרגנו את גרסת ה-Node בשרת, נראה תקין.",
      },
    ],
    decisiveArtifactKeyQ1: "schedules",
    decisiveArtifactKeyQ3: "limitsdoc",
    q1Options: [
      { text: "טוקן ההתחברות פג בשעה קבועה" },
      {
        text: `report_job שנוסף לפני שבוע משתמש באותו מפתח API כמו sync_job, וביחד הם חורגים מהמכסה היומית המשותפת אחר הצהריים`,
        correct: true,
      },
      { text: "יש הגבלת burst בגלל ריצה מקבילית" },
      { text: "שדרוג ה-Node גרם לתקלה" },
    ],
    q3Prompt: "מה המכסה היומית של קריאות API, לפי התיעוד?",
    q3Fact: String(dailyLimit),
    correctActionText: "להפריד בין sync_job ל-report_job למפתחות API נפרדים, או לתאם ביניהם כך שלא יחרגו מהמכסה המשותפת",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את report_job לצמיתות",
      treat_symptom: "להריץ שוב את sync_job ידנית בכל פעם שהוא נכשל",
      fix_decoy: "לבדוק את שדרוג ה-Node",
      busywork_gather_more: "לאסוף את כל לוגי הסנכרון של השנה שעברה",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const burstLimit = rng.pick([10, 20]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "log",
        label: "לוג סנכרון",
        body: "14:02:00.1  429 rate_limited\n14:02:00.2  429 rate_limited\n14:02:00.3  429 rate_limited",
      },
      {
        key: "limitsdoc",
        label: "תיעוד מגבלות API",
        body: `מתוך התיעוד: "עד ${burstLimit} קריאות בשנייה (burst limit) לכל מפתח. חריגה גורמת ל-429 מיידי, גם אם המכסה היומית רחוקה מלהתמלא."`,
      },
      {
        key: "code",
        label: "קוד הסנכרון (מקוצר)",
        body: `for record in records:\n    api.send(record)  # נשלח לכל הרשומות במקביל, בלי הגבלת קצב`,
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "רועי: המכסה היומית שלנו רחוקה מלהתמלא, מוזר.",
      },
    ],
    decisiveArtifactKeyQ1: "code",
    decisiveArtifactKeyQ3: "limitsdoc",
    q1Options: [
      { text: "המכסה היומית מתמלאת אחר הצהריים" },
      {
        text: `הקוד שולח את כל הרשומות במקביל בלי הגבלת קצב, וחוצה את מגבלת ה-burst (${burstLimit} קריאות בשנייה) מיידית`,
        correct: true,
      },
      { text: "טוקן ההתחברות מתחדש כל יום ב-15:00" },
      { text: "יש בעיית רשת שגורמת לכשלים" },
    ],
    q3Prompt: "מה מגבלת ה-burst (קריאות בשנייה), לפי התיעוד?",
    q3Fact: String(burstLimit),
    correctActionText: "להוסיף הגבלת קצב (throttling) לקוד כך שלא יחרוג ממגבלת ה-burst, ולוודא שהסנכרון עובר בלי 429",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להחליף לגמרי את ספק ה-API בגלל המגבלה",
      treat_symptom: "להריץ שוב ושוב עד שזה עובר במקרה",
      fix_decoy: "לבדוק את מועד חידוש הטוקן",
      busywork_gather_more: "לבדוק את כל הרשומות שנשלחו בשנה האחרונה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const hour = rng.pick([15, 16]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "log",
        label: "לוג סנכרון",
        body: `${hour}:00:02  401 token_expired\n${hour}:00:05  401 token_expired\n${hour}:00:09  200 ok (after refresh)`,
      },
      {
        key: "config",
        label: "הגדרת רענון טוקן",
        body: `refresh_schedule: cron "0 ${hour} * * *"\nsync_job schedule: כל יום באותה שעה בדיוק (אותה שעה בול)`,
      },
      {
        key: "docs",
        label: "תיעוד אימות הספק",
        body: 'מתוך התיעוד: "טוקן שפג מחזיר 401. יש לרענן טוקן ולנסות שוב; אין רענון אוטומטי מובנה בצד השרת שלנו."',
      },
      {
        key: "billing",
        label: "חשבונית",
        decoy: true,
        body: "החיוב החודשי תקין.",
      },
    ],
    decisiveArtifactKeyQ1: "config",
    decisiveArtifactKeyQ3: "config",
    q1Options: [
      { text: "מגבלת ה-burst נחצתה" },
      { text: "המכסה היומית מתמלאת" },
      {
        text: `רענון הטוקן ו-sync_job מתוזמנים לאותה שעה בדיוק (${hour}:00), כך שהסנכרון לפעמים רץ עם טוקן שפג רגע לפני הרענון`,
        correct: true,
      },
      { text: "יש בעיה בחשבונית מול הספק" },
    ],
    q3Prompt: 'מה ביטוי ה-cron של רענון הטוקן (השדה "refresh_schedule")?',
    q3Fact: `0 ${hour} * * *`,
    correctActionText: "להזיז את תזמון רענון הטוקן כמה דקות לפני sync_job (או להוסיף רענון אוטומטי בקבלת 401), ולוודא שהסנכרון עובר",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את דרישת האימות מול הספק",
      treat_symptom: "להריץ את sync_job שוב ידנית כל יום אחרי הכישלון הראשון",
      fix_decoy: "לבדוק את החיוב מול הספק",
      busywork_gather_more: "לעבור על כל תזמוני העבודות בכל המערכות",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.sync_rate_limited",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
