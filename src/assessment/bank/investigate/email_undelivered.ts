// investigate.email_undelivered — ASSESSMENT_DESIGN.md §3.3 /
// DECISIONS_LOG.md #8: the provider's verification screen and doc excerpt
// are put in the artifacts so the DNS-record semantics are stated, not assumed.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "מיילים מהדומיין החדש שלנו לא מגיעים ללקוחות, חוזרים כ-bounce."';

function buildA(rng: Rng): VariantWorld {
  const domain = rng.pick(["example-mail.co.il", "notices.example.co.il"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "verify",
        label: "מסך אימות דומיין — ספק המייל",
        body: `דומיין: ${domain}\nSPF: PASS\nDKIM: PASS\nDMARC: FAIL — רשומת TXT חסרה`,
      },
      {
        key: "docs",
        label: "תיעוד הספק",
        body: 'מתוך תיעוד הספק: "רשומת DMARC (TXT ב-_dmarc.<domain>) נדרשת כדי שהודעות ייחשבו מאומתות במלואן. בלעדיה, ספקי מייל רבים ידחו או יעבירו ל-spam הודעות מדומיינים חדשים, גם אם SPF ו-DKIM תקינים."',
      },
      {
        key: "dns",
        label: "רשומות DNS נוכחיות",
        body: `${domain}: TXT (SPF) קיים, DKIM CNAME קיים\n_dmarc.${domain}: לא קיימת רשומה`,
      },
      {
        key: "template",
        label: "הגדרות תבנית מייל",
        decoy: true,
        body: "תבנית ה-HTML עודכנה השבוע לעיצוב חדש.",
      },
    ],
    decisiveArtifactKeyQ1: "verify",
    decisiveArtifactKeyQ3: "dns",
    q1Options: [
      {
        text: "כתובת השולח בתבנית המייל שגויה ומצביעה בטעות לדומיין שאינו קיים בכלל ברשת, ולכן כל שרתי הדואר המקבלים דוחים כל הודעה בודדת מיד עם קבלתה בלי שום חריגים",
      },
      {
        text: `בדיקת האימות של הספק מראה DMARC=FAIL בגלל רשומת TXT חסרה תחת _dmarc.${domain}, לפי תיעוד הספק זה גורם לדחייה/spam לדומיינים חדשים`,
        correct: true,
      },
      {
        text: "הנמענים נמצאים ברשימת ההשעיה (suppression list) הכללית של הספק בעקבות דיווחי spam קודמים ורבים שהתקבלו מאותו דומיין בדיוק",
      },
      {
        text: "עיצוב ה-HTML החדש שעודכן בשקט השבוע בתבנית ההודעה גורם לספקי המייל השונים לסמן את ההודעה כחשודה ולחסום אותה באופן מיידי",
      },
    ],
    q3Prompt: "תחת איזו רשומת DNS חסרה ה-TXT הנדרשת?",
    q3Fact: `_dmarc.${domain}`,
    correctActionText: "להוסיף את רשומת ה-DMARC (TXT) החסרה תחת _dmarc בדומיין, ולוודא שהאימות עובר ושהמיילים מגיעים",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לעבור לדומיין שליחה אחר לגמרי ולוותר על הדומיין החדש, בלי לבדוק קודם מה בדיוק חסר באימות שלו",
      treat_symptom: "לבקש מכל הלקוחות לחפש ידנית בתיקיית ה-spam שלהם, במקום לתקן את סיבת הדחייה בצד השולח",
      fix_decoy: "לחקור לעומק את עיצוב ה-HTML החדש בתבנית, למרות שמסך האימות מצביע במפורש על כשל DMARC",
      busywork_gather_more: "לאסוף רשימה מלאה של כל הלקוחות שלא קיבלו מייל בחודש האחרון לפני שמוסיפים את רשומת ה-DNS החסרה",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const wrongDomain = rng.pick(["old-mailer.co.il", "legacy-notices.co.il"]);
  const rightDomain = "example.co.il";
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "verify",
        label: "מסך אימות דומיין — ספק המייל",
        body: `דומיין מאומת: ${rightDomain} — SPF: PASS, DKIM: PASS, DMARC: PASS`,
      },
      {
        key: "docs",
        label: "תיעוד הספק",
        body: 'מתוך תיעוד הספק: "יש לשלוח מכתובת מתחת לדומיין המאומת בלבד. שליחה מדומיין לא מאומת נדחית או מסומנת spam, גם אם הדומיין קיים ותקין בפני עצמו."',
      },
      {
        key: "template",
        label: "הגדרות תבנית מייל",
        body: `from_address: notices@${wrongDomain}\n(עודכן לפני שבוע בטעות — הדומיין הישן ${wrongDomain} לא מאומת אצל הספק)`,
      },
      {
        key: "bounce",
        label: "לוג bounce",
        decoy: true,
        body: "כמות ה-bounce עלתה במקביל לעדכון תבנית העיצוב, אך זה רק תזמון מקרי.",
      },
    ],
    decisiveArtifactKeyQ1: "template",
    decisiveArtifactKeyQ3: "verify",
    q1Options: [
      {
        text: `רשומת ה-DMARC (TXT תחת _dmarc.${rightDomain}) חסרה מהדומיין המאומת, ולכן הודעות נדחות למרות ש-SPF ו-DKIM תקינים`,
      },
      {
        text: `כתובת השולח בתבנית עודכנה בטעות לדומיין ${wrongDomain}, שאינו מאומת אצל הספק — רק ${rightDomain} מאומת`,
        correct: true,
      },
      {
        text: "הנמענים נמצאים ברשימת השעיה (suppression list) אצל הספק בעקבות hard bounce קודם מאותה כתובת",
      },
      {
        text: "עיצוב התבנית שעודכן לפני שבוע גורם לספקי המייל לסמן את ההודעה כחשודה ולחסום אותה בכניסה",
      },
    ],
    q3Prompt: "מה הדומיין המאומת אצל הספק?",
    q3Fact: rightDomain,
    correctActionText: `לתקן את כתובת השולח בתבנית חזרה לדומיין המאומת ${rightDomain}, ולוודא שהמיילים נשלחים בהצלחה`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את התבנית כולה ולבנות אחת חדשה מאפס, כולל כל שאר ההגדרות שעבדו תקין עד היום",
      treat_symptom: "לשלוח את כל המיילים באופן ידני מתיבת דואר אישית עד שמישהו יתקן את כתובת השולח בתבנית",
      fix_decoy: "לחקור לעומק את עדכון עיצוב התבנית מלפני שבוע, למרות שמסך האימות מראה שהדומיין הנוכחי אינו מאומת",
      busywork_gather_more: "לעבור על כל תבניות המייל בחברה בחיפוש כתובות שולח דומות לפני שמתקנים את זו שכבר אותרה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const recipientDomain = rng.pick(["client-corp.com", "partner-inc.com"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "verify",
        label: "מסך אימות דומיין — ספק המייל",
        body: "דומיין השולח מאומת במלואו: SPF: PASS, DKIM: PASS, DMARC: PASS",
      },
      {
        key: "docs",
        label: "תיעוד הספק",
        body: 'מתוך תיעוד הספק: "כתובת שדיווחה בעבר על ההודעה כ-spam, או שהחזירה bounce קשיח (hard bounce), נכנסת לרשימת השעיה (suppression list) ולא תקבל הודעות נוספות עד הסרה ידנית."',
      },
      {
        key: "suppression",
        label: "רשימת השעיה (suppression list)",
        body: `contact@${recipientDomain} — נוסף לרשימה לפני חודש עקב hard bounce (תיבה לא קיימת אז)`,
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: "רועי: בדקתי את שרת ה-SMTP שלנו, נראה תקין לגמרי.",
      },
    ],
    decisiveArtifactKeyQ1: "suppression",
    decisiveArtifactKeyQ3: "suppression",
    q1Options: [
      {
        text: "רשומת ה-DMARC (TXT תחת _dmarc) חסרה לגמרי מהדומיין השולח כולו, ולכן ההודעות נדחות אצל כל הנמענים ולא רק אצל נמען יחיד",
      },
      {
        text: "כתובת השולח אינה מאומתת כלל אצל הספק בבדיקת האימות, ולכן ההודעות נדחות עוד לפני שהן יוצאות מהשרת החוצה",
      },
      {
        text: `כתובת הנמען (contact@${recipientDomain}) נמצאת ברשימת ההשעיה של הספק בעקבות hard bounce קודם, ולכן חסומה מקבלת הודעות`,
        correct: true,
      },
      {
        text: "שרת ה-SMTP אינו מוגדר נכון בצד השולח ומחזיר שגיאת חיבור זמנית שגורמת להודעות לחזור כ-bounce שוב ושוב",
      },
    ],
    q3Prompt: "איזו כתובת מייל נמצאת ברשימת ההשעיה?",
    q3Fact: `contact@${recipientDomain}`,
    correctActionText: "לוודא מול הלקוח שהכתובת פעילה כעת, ולהסיר אותה מרשימת ההשעיה אצל הספק לפני שליחה חוזרת",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להסיר את כל רשימת ההשעיה בבת אחת כדי לפתור מהר, כולל כתובות שהושעו בצדק בעקבות דיווחי spam",
      treat_symptom: "לשלוח את אותו מייל שוב ושוב לאותה כתובת בתקווה שאחת מהפעמים תעבור, בלי לבדוק את סטטוס ההשעיה",
      fix_decoy: "לבדוק לעומק את הגדרות שרת ה-SMTP, למרות שבדיקת האימות מראה שהדומיין השולח תקין ומאומת במלואו",
      busywork_gather_more: "לעבור על כל רשימת ההשעיה של השנה האחרונה בחיפוש כתובות דומות לפני שמסירים את זו שכבר אותרה",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.email_undelivered",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
