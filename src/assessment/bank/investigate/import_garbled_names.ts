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
      { text: "עמודות הקובץ הוזזו בגלל פסיק בתוך שם" },
      {
        text: `הקובץ נבחר עם קידוד ${wrongEncoding} בעוד שהוא בפועל UTF-8, וזה מייצר תווים משובשים בעברית`,
        correct: true,
      },
      { text: "מיפוי השדות הפוך בין שם פרטי למשפחה" },
      { text: "דפדפן הצוות שהשתדרג גרם לבעיה" },
    ],
    q3Prompt: "איזה קידוד (encoding) נבחר בטעות בהגדרות הייבוא?",
    q3Fact: wrongEncoding,
    correctActionText: "לבטל את הייבוא, לבחור UTF-8 כקידוד הנכון ולייבא מחדש כדי לוודא שהשמות מוצגים תקין",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות שיובאו ולהתחיל איסוף נתונים מאפס",
      treat_symptom: "לתקן ידנית כל שם משובש אחד-אחד",
      fix_decoy: "לחקור את שדרוג דפדפן הצוות",
      busywork_gather_more: "לעבור על כל קבצי הייבוא ההיסטוריים לפני שמתקנים את הנוכחי",
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
      { text: "קידוד הקובץ שגוי" },
      {
        text: 'השורה הראשונה מכילה פסיק בתוך ערך מוקף מרכאות ("כהן, עורכת דין"), וכלי הייבוא לא מטפל בזה נכון, כך שהעמודות זזות',
        correct: true,
      },
      { text: "מיפוי שם פרטי/משפחה הפוך" },
      { text: "עדכון הלוגו בקובץ הייצוא גרם לבעיה" },
    ],
    q3Prompt: "מה הערך המדויק (עם הפסיק) שבתוך המרכאות בשורה הראשונה של הקובץ?",
    q3Fact: "כהן, עורכת דין",
    correctActionText: "לתקן את מנתח ה-CSV (parser) כך שיטפל נכון בערכים מוקפי מרכאות עם פסיק בפנים, ולייבא מחדש",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות ולהזין ידנית מאפס",
      treat_symptom: "לתקן ידנית רק את השורה הבעייתית בקובץ הנוכחי בלי לתקן את המנתח",
      fix_decoy: "לחקור את עדכון הלוגו בקובץ הייצוא",
      busywork_gather_more: "לעבור על כל קבצי ה-CSV ההיסטוריים לפני שמתקנים את המנתח",
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
      { text: "קידוד הקובץ שגוי" },
      { text: "יש פסיק בתוך ערך שמזיז עמודות" },
      {
        text: "מיפוי העמודות בייבוא הפוך: first_name ממופה לשדה שם משפחה ולהפך",
        correct: true,
      },
      { text: "שדרוג דפדפן הצוות גרם לבעיה" },
    ],
    q3Prompt: "לאיזה שדה יעד ממופה עמודת הקובץ first_name (בטעות)? (כפי שכתוב במסך המיפוי, כולל המרכאות)",
    q3Fact: "'שם משפחה'",
    q3Alternates: ["שם משפחה"],
    correctActionText: "לתקן את מיפוי העמודות כך ש-first_name ימופה לשם פרטי ו-last_name לשם משפחה, ולייבא מחדש",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות שיובאו בלי לתקן את המיפוי קודם",
      treat_symptom: "להחליף ידנית שם פרטי ומשפחה בכל רשומה שיובאה",
      fix_decoy: "לבדוק שוב את קידוד הקובץ למרות שהוא כבר תקין",
      busywork_gather_more: "לעבור על כל הגדרות המיפוי בכל הייבואים ההיסטוריים",
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
