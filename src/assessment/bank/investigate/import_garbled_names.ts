// investigate.import_garbled_names — ASSESSMENT_DESIGN.md §3.3. Customer
// names import with wrong characters.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "אחרי הייבוא האחרון, חלק מהשמות של לקוחות מופיעים עם תווים משובשים."';

function buildA(rng: Rng): VariantWorld {
  const wrongEncoding = rng.pick(["Windows-1255", "ISO-8859-1"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "importsettings",
        label: "הגדרות ייבוא",
        body: `קידוד קובץ שנבחר: ${wrongEncoding}\nקידוד בפועל של הקובץ: UTF-8`,
      },
      {
        key: "sample",
        label: "דוגמת שורות מהקובץ המקורי",
        body: "דנה כהן\nיוסי לוי\nמאיה אברהם",
      },
      {
        key: "preview",
        label: "תצוגה מקדימה אחרי ייבוא",
        body: "×“× ×” ×›×”×Ÿ\n×™×•×¡×™ ×œ×•×™\n×ž×™×” ××‘×¨×”×",
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: "רועי: שדרגנו את דפדפן הצוות בשבוע שעבר, לא קשור לזה.",
      },
    ],
    decisiveArtifactKeyQ1: "importsettings",
    decisiveArtifactKeyQ3: "importsettings",
    q1Options: [
      {
        text: "עמודות הקובץ הוזזו בגלל פסיק שהופיע בתוך שם מוקף מרכאות, וזה מה שגורם לתווים המשובשים בתצוגה",
      },
      {
        text: `הקובץ נבחר עם קידוד ${wrongEncoding} בעוד שהוא בפועל UTF-8, וזה מייצר תווים משובשים בעברית`,
        correct: true,
      },
      {
        text: "מיפוי השדות בייבוא הפוך בין שם פרטי למשפחה, כך שהתוכן מוצג בעמודה הלא נכונה אך לא משובש",
      },
      {
        text: "שדרוג דפדפן הצוות שבוצע השבוע משנה את אופן קידוד הטקסט המועתק, וגורם לתווים המשובשים בתצוגה",
      },
    ],
    q3Prompt: "איזה קידוד (encoding) נבחר בטעות בהגדרות הייבוא?",
    q3Fact: wrongEncoding,
    correctActionText: "לבטל את הייבוא, לבחור UTF-8 כקידוד הנכון ולייבא מחדש כדי לוודא שהשמות מוצגים תקין",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות שיובאו ולהתחיל איסוף נתונים מאפס, כולל רשומות שלא נפגעו כלל מהתקלה",
      treat_symptom: "לתקן ידנית כל שם משובש אחד-אחד ברשימה, במקום לתקן את הקידוד ולייבא את כל הקובץ מחדש",
      fix_decoy: "לחקור לעומק את שדרוג דפדפן הצוות מהשבוע, למרות שהגדרות הייבוא מראות בבירור קידוד שגוי שנבחר",
      busywork_gather_more: "לעבור על כל קבצי הייבוא ההיסטוריים לפני שמתקנים את הקידוד השגוי בקובץ הנוכחי",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  void rng;
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "sample",
        label: "דוגמת שורות מהקובץ המקורי (CSV)",
        body: 'דנה כהן,dana@x.com,"כהן, עורכת דין",050-1111111\nיוסי לוי,yossi@x.com,מנהל,050-2222222',
      },
      {
        key: "preview",
        label: "תצוגה מקדימה אחרי ייבוא",
        body: 'שם: דנה כהן | אימייל: dana@x.com | תפקיד: "כהן | טלפון: עורכת דין"\nשם: יוסי לוי | אימייל: yossi@x.com | תפקיד: מנהל | טלפון: 050-2222222',
      },
      {
        key: "importsettings",
        label: "הגדרות ייבוא",
        body: "מפריד עמודות: פסיק (,) — ללא טיפול מיוחד בערכים שמכילים פסיק בתוך מרכאות",
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: "מאיה: עדכנו את הלוגו בקובץ הייצוא, לא אמור להשפיע.",
      },
    ],
    decisiveArtifactKeyQ1: "sample",
    decisiveArtifactKeyQ3: "sample",
    q1Options: [
      {
        text: "קידוד הקובץ נבחר שגוי לגמרי ביחס לקידוד האמיתי שלו בהגדרות הייבוא, וזו הסיבה שהתווים בעמודת התפקיד מוצגים משובשים",
      },
      {
        text: 'השורה הראשונה מכילה פסיק בתוך ערך מוקף מרכאות ("כהן, עורכת דין"), וכלי הייבוא לא מטפל בזה נכון, כך שהעמודות זזות',
        correct: true,
      },
      {
        text: "מיפוי השדות בייבוא הפוך לגמרי בין שם פרטי למשפחה עבור כל הרשומות שיובאו, כולל אלה שבשורה השנייה שיובאה כביכול תקין",
      },
      {
        text: "עדכון הלוגו בקובץ הייצוא שבוצע בשקט לאחרונה משנה את מבנה הכותרות הפנימי, וגורם לעמודות להיות ממופות בסדר שגוי לגמרי",
      },
    ],
    q3Prompt: "מה הערך המדויק (עם הפסיק) שבתוך המרכאות בשורה הראשונה של הקובץ?",
    q3Fact: "כהן, עורכת דין",
    correctActionText: "לתקן את מנתח ה-CSV (parser) כך שיטפל נכון בערכים מוקפי מרכאות עם פסיק בפנים, ולייבא מחדש",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות שיובאו ולהזין את הנתונים ידנית מאפס, כולל שורות שיובאו נכון לגמרי",
      treat_symptom: "לתקן ידנית רק את השורה הבעייתית בקובץ הנוכחי, בלי לתקן את המנתח שיכשל שוב בייבוא הבא",
      fix_decoy: "לחקור לעומק את עדכון הלוגו בקובץ הייצוא, למרות שדוגמת השורות מראה בבירור פסיק בתוך ערך מוקף מרכאות",
      busywork_gather_more: "לעבור על כל קבצי ה-CSV ההיסטוריים בחיפוש בעיות דומות לפני שמתקנים את המנתח שכבר אותר כתקול",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  void rng;
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "mapping",
        label: "מיפוי עמודות בייבוא",
        body: "עמודת קובץ 'first_name' -> ממופה לשדה 'שם משפחה'\nעמודת קובץ 'last_name' -> ממופה לשדה 'שם פרטי'",
      },
      {
        key: "sample",
        label: "דוגמת שורות מהקובץ המקורי (CSV, עמודה 1 ואז עמודה 2)",
        body: "דנה,כהן\nיוסי,לוי",
      },
      {
        key: "preview",
        label: "תצוגה מקדימה אחרי ייבוא",
        body: 'שם פרטי: כהן, שם משפחה: דנה\nשם פרטי: לוי, שם משפחה: יוסי',
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: "עידו: הקידוד של הקובץ נראה תקין, UTF-8.",
      },
    ],
    decisiveArtifactKeyQ1: "mapping",
    decisiveArtifactKeyQ3: "mapping",
    q1Options: [
      {
        text: "קידוד הקובץ שנבחר בייבוא שגוי ביחס לקידוד האמיתי שלו, וזו הסיבה שהשמות מוצגים הפוכים בתצוגה",
      },
      {
        text: "יש פסיק בתוך ערך מוקף מרכאות בקובץ המקור שמזיז את שאר העמודות שמאלה, וגורם לתוכן שגוי בשדות",
      },
      {
        text: "מיפוי העמודות בייבוא הפוך: first_name ממופה לשדה שם משפחה ולהפך, ולכן כל שם מוצג בסדר הפוך",
        correct: true,
      },
      {
        text: "שדרוג דפדפן הצוות שבוצע לאחרונה משנה את סדר הצגת השדות במסך התצוגה המקדימה בלבד",
      },
    ],
    q3Prompt: "לאיזה שדה יעד ממופה עמודת הקובץ first_name (בטעות)? (כפי שכתוב במסך המיפוי, כולל המרכאות)",
    q3Fact: "'שם משפחה'",
    q3Alternates: ["שם משפחה"],
    correctActionText: "לתקן את מיפוי העמודות כך ש-first_name ימופה לשם פרטי ו-last_name לשם משפחה, ולייבא מחדש",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות שיובאו בלי לתקן את המיפוי קודם, ולאבד גם נתונים שלא נפגעו מהתקלה",
      treat_symptom: "להחליף ידנית שם פרטי ומשפחה בכל רשומה שכבר יובאה, בלי לתקן את מסך המיפוי שיכשל שוב בפעם הבאה",
      fix_decoy: "לבדוק שוב את קידוד הקובץ למרות שהצ'אט כבר ציין שהוא UTF-8 תקין ואין קשר לבעיית התווים כאן",
      busywork_gather_more: "לעבור על כל הגדרות המיפוי בכל הייבואים ההיסטוריים לפני שמתקנים את המיפוי שכבר אותר כהפוך",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.import_garbled_names",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
