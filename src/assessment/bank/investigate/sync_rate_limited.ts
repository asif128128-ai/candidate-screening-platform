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
      {
        text: "טוקן ההתחברות מול הספק פג בשעה קבועה כל יום אחר הצהריים בדיוק, ומחדש את עצמו רק לאחר כמה דקות עיכוב מיותרות לגמרי",
      },
      {
        text: `report_job שנוסף לפני שבוע משתמש באותו מפתח API כמו sync_job, וביחד הם חורגים מהמכסה היומית המשותפת אחר הצהריים`,
        correct: true,
      },
      {
        text: "יש הגבלת burst שנחצית שוב ושוב בגלל ריצה מקבילית של כמה תהליכים באותה שנייה בדיוק כל אחר צהריים בערך",
      },
      {
        text: "שדרוג גרסת ה-Node שבוצע בשקט בשרת בסוף השבוע שינה לגמרי את אופן ניהול החיבורים הפתוחים, וגרם לכשלים אקראיים בסנכרון",
      },
    ],
    q3Prompt: "מה המכסה היומית של קריאות API, לפי התיעוד?",
    q3Fact: String(dailyLimit),
    correctActionText: "להפריד בין sync_job ל-report_job למפתחות API נפרדים, או לתאם ביניהם כך שלא יחרגו מהמכסה המשותפת",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את report_job לצמיתות ולאבד את הדוח שהוא מייצר, במקום פשוט להפריד בינו לבין sync_job",
      treat_symptom: "להריץ שוב את sync_job ידנית בכל פעם שהוא נכשל אחר הצהריים, בלי לתקן את חריגת המכסה המשותפת",
      fix_decoy: "לבדוק לעומק את שדרוג גרסת ה-Node מהשבוע, למרות שהתיעוד מצביע במפורש על חריגת מכסה יומית משותפת",
      busywork_gather_more: "לאסוף את כל לוגי הסנכרון של השנה שעברה בכל השירותים לפני שמפרידים בין שתי העבודות שכבר אותרו",
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
      {
        text: "המכסה היומית של קריאות ה-API מתמלאת אחר הצהריים בגלל עבודה נוספת שמשתפת בטעות את אותו מפתח בדיוק",
      },
      {
        text: `הקוד שולח את כל הרשומות במקביל בלי הגבלת קצב, וחוצה את מגבלת ה-burst (${burstLimit} קריאות בשנייה) מיידית`,
        correct: true,
      },
      {
        text: "טוקן ההתחברות מתחדש כל יום ב-15:00 בדיוק בלי חריגה, וגורם לכמה שניות בודדות של כשלי אימות בזמן הריצה",
      },
      {
        text: "יש בעיית רשת מתמשכת וחוזרת בין שרת הסנכרון לספק שגורמת לכשלים חוזרים באותה שעה בדיוק בכל יום",
      },
    ],
    q3Prompt: "מה מגבלת ה-burst (קריאות בשנייה), לפי התיעוד?",
    q3Fact: String(burstLimit),
    correctActionText: "להוסיף הגבלת קצב (throttling) לקוד כך שלא יחרוג ממגבלת ה-burst, ולוודא שהסנכרון עובר בלי 429",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להחליף לגמרי את ספק ה-API בגלל המגבלה, במקום פשוט להוסיף הגבלת קצב לקוד הקיים",
      treat_symptom: "להריץ את הסנכרון שוב ושוב עד שהוא עובר במקרה, בלי לתקן את הקוד ששולח הכול במקביל",
      fix_decoy: "לבדוק לעומק את מועד חידוש הטוקן, למרות שהלוג מראה כשלי burst מיידיים ולא כשלי אימות",
      busywork_gather_more: "לבדוק את כל הרשומות שנשלחו בשנה האחרונה לפני שמוסיפים הגבלת קצב לקוד שכבר אותר כבעייתי",
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
      {
        text: "מגבלת ה-burst נחצתה שוב ושוב בכל יום כי הקוד שולח יותר מדי קריאות בשנייה אחת בדיוק, וזה מסביר את הכשלים החוזרים",
      },
      {
        text: "המכסה היומית של קריאות ה-API מתמלאת בכל יום בגלל עבודה נוספת שמשתפת בטעות את אותו מפתח באותה שעה בדיוק",
      },
      {
        text: `רענון הטוקן ו-sync_job מתוזמנים לאותה שעה בדיוק (${hour}:00), כך שהסנכרון לפעמים רץ עם טוקן שפג רגע לפני הרענון`,
        correct: true,
      },
      {
        text: "יש בעיה מתמשכת וחריגה בחשבונית מול הספק שגורמת להשעיה זמנית וחוזרת של הגישה בכל יום באותה שעה בדיוק",
      },
    ],
    q3Prompt: 'מה ביטוי ה-cron של רענון הטוקן (השדה "refresh_schedule")?',
    q3Fact: `0 ${hour} * * *`,
    correctActionText: "להזיז את תזמון רענון הטוקן כמה דקות לפני sync_job (או להוסיף רענון אוטומטי בקבלת 401), ולוודא שהסנכרון עובר",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את דרישת האימות מול הספק לגמרי, במקום פשוט להזיז את תזמון רענון הטוקן כמה דקות קודם",
      treat_symptom: "להריץ את sync_job שוב ידנית כל יום אחרי הכישלון הראשון, בלי לתקן את התזמון שגורם לחיכוך עם הרענון",
      fix_decoy: "לבדוק לעומק את החיוב מול הספק, למרות שהלוג מראה כשלי טוקן פג ולא כשלי חיוב או הרשאה",
      busywork_gather_more: "לעבור על כל תזמוני העבודות בכל המערכות לפני שמזיזים את תזמון הרענון שכבר אותר כחופף",
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
