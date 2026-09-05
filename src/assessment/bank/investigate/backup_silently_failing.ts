// investigate.backup_silently_failing — ASSESSMENT_DESIGN.md §3.3. Restore
// test found the last good backup is 3 weeks old.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "בדיקת שחזור גילתה שהגיבוי התקין האחרון הוא מלפני 3 שבועות."';

function buildA(rng: Rng): VariantWorld {
  const usedPct = rng.nextIntBetween(96, 99);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "runs",
        label: "היסטוריית הרצות גיבוי",
        body: "לפני 21 יום: 4.2GB, success\nלפני 14 יום: 0KB, success (!)\nלפני 7 יום: 0KB, success (!)\nאתמול: 0KB, success (!)",
      },
      {
        key: "bucket",
        label: "ניצול דלי היעד לגיבוי",
        body: `נפח בשימוש: ${usedPct}% מהמכסה\n(המכסה לא הוגדלה מזה 6 חודשים למרות גידול בנתונים)`,
      },
      {
        key: "creds",
        label: "יומן סודות/הרשאות",
        body: "אין שינוי בהרשאות הגיבוי ב-90 הימים האחרונים.",
      },
      {
        key: "schedule",
        label: "הגדרת תזמון",
        decoy: true,
        body: "תזמון: כל יום ב-02:00, ללא שינוי.",
      },
    ],
    decisiveArtifactKeyQ1: "bucket",
    decisiveArtifactKeyQ3: "bucket",
    q1Options: [
      { text: "הסודות (credentials) של הגיבוי הוחלפו" },
      {
        text: `דלי היעד לגיבוי מלא כמעט לגמרי (${usedPct}%), כך שהגיבויים נכשלים בשקט וכותבים 0 בייטים בלי לדווח שגיאה`,
        correct: true,
      },
      { text: "התזמון של הגיבוי השתנה ליום שלא קיים" },
      { text: "יש בעיית רשת שמונעת גיבוי" },
    ],
    q3Prompt: "כמה אחוזים מהמכסה בדלי היעד לגיבוי בשימוש?",
    q3Fact: `${usedPct}%`,
    correctActionText: "להגדיל את מכסת דלי היעד (או לפנות מקום/להוסיף אחסון) ולהריץ גיבוי מחדש כדי לוודא שהוא כותב בהצלחה",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק גיבויים ישנים בלי לבדוק אם צריך אותם",
      treat_symptom: "להריץ שוב את הגיבוי בלי לפנות מקום קודם",
      fix_decoy: "לבדוק את הגדרת התזמון למרות שהיא לא השתנתה",
      busywork_gather_more: "לעבור על כל היסטוריית הגיבויים של השנה האחרונה לפני שפועלים",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const rotatedDaysAgo = rng.nextIntBetween(20, 23);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "runs",
        label: "היסטוריית הרצות גיבוי",
        body: "לפני 21 יום: 4.1GB, success\nלפני 14 יום: 0KB, success (!)\nלפני 7 יום: 0KB, success (!)",
      },
      {
        key: "credsaudit",
        label: "יומן ביקורת סודות",
        body: `לפני ${rotatedDaysAgo} ימים: צוות התשתיות סובב (rotate) את מפתח הגישה לאחסון הגיבוי; משימת הגיבוי לא עודכנה עם המפתח החדש`,
      },
      {
        key: "docs",
        label: "תיעוד כלי הגיבוי",
        body: 'מתוך תיעוד הכלי: "אם מפתח הגישה שגוי, הכלי כותב קובץ ריק ומסמן success — אין אימות תוכן אוטומטי אחרי הכתיבה."',
      },
      {
        key: "bucket",
        label: "ניצול דלי היעד",
        decoy: true,
        body: "ניצול: 40% מהמכסה, רחוק מלהתמלא.",
      },
    ],
    decisiveArtifactKeyQ1: "credsaudit",
    decisiveArtifactKeyQ3: "credsaudit",
    q1Options: [
      { text: "דלי היעד מלא" },
      {
        text: `מפתח הגישה לאחסון סובב לפני ${rotatedDaysAgo} ימים על ידי צוות אחר, ומשימת הגיבוי ממשיכה להשתמש במפתח הישן — לפי תיעוד הכלי זה גורם ל"הצלחה" עם קובץ ריק`,
        correct: true,
      },
      { text: "התזמון השתנה ליום שלא קיים" },
      { text: "יש בעיית רשת" },
    ],
    q3Prompt: "לפני כמה ימים סובב מפתח הגישה לאחסון הגיבוי?",
    q3Fact: String(rotatedDaysAgo),
    correctActionText:
      "לדווח לצוות התשתיות (בעלי המפתח) עם הראיות מיומן הביקורת ולבקש את המפתח המעודכן כדי לתקן את משימת הגיבוי",
    isEscalationRequired: true,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את משימת הגיבוי ולהקים אחת חדשה מאפס",
      treat_symptom: "להריץ גיבוי ידני חד-פעמי בלי לתקן את המפתח",
      fix_decoy: "לפנות מקום בדלי היעד למרות שהוא רחוק מלהתמלא",
      busywork_gather_more: "לעבור על כל סבבי המפתחות של השנה האחרונה בכל המערכות",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  void rng;
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "schedule",
        label: "הגדרת תזמון גיבוי",
        body: "תזמון: יום 31 בכל חודש, 02:00\n(חודשים עם פחות מ-31 יום — הריצה פשוט לא מתרחשת, בלי שגיאה)",
      },
      {
        key: "runs",
        label: "היסטוריית הרצות גיבוי",
        body: "אוגוסט 31: 4.0GB, success\nספטמבר: אין הרצה כלל (30 יום בחודש)\nאוקטובר 31: (טרם הגיע)",
      },
      {
        key: "docs",
        label: "תיעוד מנגנון התזמון",
        body: 'מתוך התיעוד: "תזמון לפי מספר יום קבוע בחודש (למשל 31) פשוט מדלג על חודשים קצרים יותר — אין דיווח שגיאה במקרה כזה."',
      },
      {
        key: "bucket",
        label: "ניצול דלי היעד",
        decoy: true,
        body: "ניצול: 35% מהמכסה.",
      },
    ],
    decisiveArtifactKeyQ1: "schedule",
    decisiveArtifactKeyQ3: "schedule",
    q1Options: [
      { text: "מפתח הגישה סובב ולא עודכן" },
      { text: "דלי היעד מלא" },
      {
        text: 'התזמון מוגדר ליום "31" קבוע בחודש; בחודשים עם פחות מ-31 יום (כמו ספטמבר) הריצה פשוט לא מתרחשת, בלי שגיאה גלויה',
        correct: true,
      },
      { text: "יש בעיית רשת שחוסמת את הגיבוי" },
    ],
    q3Prompt: "לאיזה יום קבוע בחודש מתוזמן הגיבוי?",
    q3Fact: "31",
    correctActionText: 'לשנות את התזמון לביטוי שרץ בכל חודש ("היום האחרון בחודש" או תאריך קבוע כמו ה-1) ולוודא שהריצה הבאה מתבצעת',
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הגדרת התזמון כולה ולהריץ גיבויים ידניים בלבד מעתה",
      treat_symptom: "להריץ גיבוי ידני חד-פעמי בלי לתקן את התזמון",
      fix_decoy: "לפנות מקום בדלי היעד למרות שהוא רחוק מלהתמלא",
      busywork_gather_more: "לעבור על כל תזמוני המשימות בכל המערכות בחברה",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.backup_silently_failing",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: ["b"],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
