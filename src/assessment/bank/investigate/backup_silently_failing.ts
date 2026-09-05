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
      {
        text: "הסודות (credentials) של משימת הגיבוי הוחלפו בשקט לפני שלושה שבועות על ידי מישהו בצוות, כך שכל הרצה מאז נכשלת על שגיאת הרשאה שלא הוצגה בלוג",
      },
      {
        text: `דלי היעד לגיבוי מלא כמעט לגמרי (${usedPct}%), כך שהגיבויים נכשלים בשקט וכותבים 0 בייטים בלי לדווח שגיאה, למרות שהסטטוס מוצג כ-success`,
        correct: true,
      },
      {
        text: "התזמון של הגיבוי השתנה בטעות ליום שלא קיים בחלק מהחודשים, בעקבות עדכון הגדרות אחרון, כך שהריצה פשוט לא מתרחשת ולא נכתב שום קובץ",
      },
      {
        text: "יש בעיית רשת מתמשכת בין שרת הגיבוי לדלי היעד בשעות הלילה המוקדמות, שגורמת לחיבור להיסגר לפני שהנתונים מספיקים להיכתב במלואם",
      },
    ],
    q3Prompt: "כמה אחוזים מהמכסה בדלי היעד לגיבוי בשימוש?",
    q3Fact: `${usedPct}%`,
    correctActionText: "להגדיל את מכסת דלי היעד (או לפנות מקום/להוסיף אחסון) ולהריץ גיבוי מחדש כדי לוודא שהוא כותב בהצלחה",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק גיבויים ישנים כדי לפנות מקום מיד, בלי לבדוק אם מישהו עדיין תלוי באחד מהם לצורך שחזור",
      treat_symptom: "להריץ שוב את הגיבוי כפי שהוא, בלי לפנות מקום בדלי היעד קודם, ולקוות שהריצה הבאה תעבור בכל זאת",
      fix_decoy: "לבדוק לעומק את הגדרת התזמון של הגיבוי, למרות שההיסטוריה מראה שהיא לא השתנתה ושהריצות מתבצעות בזמן",
      busywork_gather_more: "לעבור על כל היסטוריית הגיבויים של השנה האחרונה בכל המערכות לפני שנוגעים בהגדרת המכסה",
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
      {
        text: "דלי היעד לגיבוי מלא כמעט לגמרי לפי בדיקת הניצול האחרונה, כך שהריצות האחרונות נכשלות בשקט בגלל חוסר מקום פנוי ולא בגלל בעיית הרשאה כלשהי שאירעה כאן",
      },
      {
        text: `מפתח הגישה לאחסון סובב לפני ${rotatedDaysAgo} ימים על ידי צוות אחר, ומשימת הגיבוי ממשיכה להשתמש במפתח הישן — לפי תיעוד הכלי זה גורם ל"הצלחה" עם קובץ ריק`,
        correct: true,
      },
      {
        text: "התזמון של הגיבוי השתנה בטעות ליום שלא קיים בחלק מהחודשים בעקבות עדכון הגדרות אחרון, כך שהריצה פשוט לא מתרחשת באותם ימים בלוח השנה העברי",
      },
      {
        text: "יש בעיית רשת מתמשכת וחוזרת בין שרת הגיבוי לאחסון היעד, שגורמת לחיבור להיסגר באמצע הכתיבה מבלי לדווח על כל שגיאה גלויה בלוג המערכת",
      },
    ],
    q3Prompt: "לפני כמה ימים סובב מפתח הגישה לאחסון הגיבוי?",
    q3Fact: String(rotatedDaysAgo),
    correctActionText:
      "לדווח לצוות התשתיות (בעלי המפתח) עם הראיות מיומן הביקורת ולבקש את המפתח המעודכן כדי לתקן את משימת הגיבוי",
    isEscalationRequired: true,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את משימת הגיבוי הקיימת ולהקים אחת חדשה מאפס עם הגדרות ברירת מחדל, בלי לבדוק קודם אם זו רק בעיית מפתח גישה שניתן לתקן",
      treat_symptom: "להריץ גיבוי ידני חד-פעמי עם המפתח הנוכחי בלי לתקן אותו כלל, כדי שיהיה לפחות גיבוי טרי אחד זמין לעכשיו",
      fix_decoy: "לפנות מקום בדלי היעד ולהגדיל את המכסה שלו, למרות שדוח הניצול מראה שהוא רחוק מלהתמלא ולא מסביר את הכשל בפועל",
      busywork_gather_more: "לעבור על כל סבבי החלפת המפתחות של השנה האחרונה בכל המערכות בחברה לפני שפונים בכלל לצוות התשתיות",
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
      {
        text: "מפתח הגישה לאחסון סובב לפני כשלושה שבועות ולא עודכן בהגדרות משימת הגיבוי, כך שהיא נכשלת בשקט מאז אותו יום",
      },
      {
        text: "דלי היעד לגיבוי מלא כמעט לגמרי לפי בדיקת הניצול, כך שהריצות האחרונות נכשלות בשקט בגלל חוסר מקום פנוי ולא תזמון",
      },
      {
        text: 'התזמון מוגדר ליום "31" קבוע בחודש; בחודשים עם פחות מ-31 יום (כמו ספטמבר) הריצה פשוט לא מתרחשת, בלי שגיאה גלויה',
        correct: true,
      },
      {
        text: "יש בעיית רשת מתמשכת בין שרת הגיבוי לאחסון היעד שחוסמת את ההתחברות בחלק מהלילות, ומונעת את הריצה כליל",
      },
    ],
    q3Prompt: "לאיזה יום קבוע בחודש מתוזמן הגיבוי?",
    q3Fact: "31",
    correctActionText: 'לשנות את התזמון לביטוי שרץ בכל חודש ("היום האחרון בחודש" או תאריך קבוע כמו ה-1) ולוודא שהריצה הבאה מתבצעת',
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הגדרת התזמון כולה ולעבור להרצת גיבויים ידניים בלבד מעתה והלאה, בלי שום תזמון אוטומטי חוזר במערכת",
      treat_symptom: "להריץ גיבוי ידני חד-פעמי היום כדי לכסות את החוסר הנוכחי, בלי לתקן את ביטוי התזמון שגורם לדילוגים חוזרים",
      fix_decoy: "לפנות מקום בדלי היעד ולהגדיל את המכסה שלו, למרות שדוח הניצול מראה שהוא רחוק מלהתמלא ולא קשור לבעיה שדווחה",
      busywork_gather_more: "לעבור על כל תזמוני המשימות האוטומטיות בכל המערכות בחברה כולה לפני שמתקנים את ביטוי הגיבוי הזה",
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
