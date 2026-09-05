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
      { text: "כתובת השולח שגויה בתבנית המייל" },
      {
        text: `בדיקת האימות של הספק מראה DMARC=FAIL בגלל רשומת TXT חסרה תחת _dmarc.${domain}, לפי תיעוד הספק זה גורם לדחייה/spam לדומיינים חדשים`,
        correct: true,
      },
      { text: "הנמענים נמצאים ברשימת ההשעיה (suppression list) של הספק" },
      { text: "עיצוב ה-HTML החדש בתבנית גורם לחסימה" },
    ],
    q3Prompt: "תחת איזו רשומת DNS חסרה ה-TXT הנדרשת?",
    q3Fact: `_dmarc.${domain}`,
    correctActionText: "להוסיף את רשומת ה-DMARC (TXT) החסרה תחת _dmarc בדומיין, ולוודא שהאימות עובר ושהמיילים מגיעים",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לעבור לדומיין שליחה אחר לגמרי",
      treat_symptom: "לבקש מהלקוחות לחפש בתיקיית ה-spam שלהם",
      fix_decoy: "לחקור את עיצוב ה-HTML החדש",
      busywork_gather_more: "לאסוף רשימה של כל הלקוחות שלא קיבלו מייל בחודש האחרון",
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
      { text: "רשומת ה-DMARC חסרה" },
      {
        text: `כתובת השולח בתבנית עודכנה בטעות לדומיין ${wrongDomain}, שאינו מאומת אצל הספק — רק ${rightDomain} מאומת`,
        correct: true,
      },
      { text: "הנמענים נמצאים ברשימת השעיה" },
      { text: "עיצוב התבנית עצמו גרם לבעיה" },
    ],
    q3Prompt: "מה הדומיין המאומת אצל הספק?",
    q3Fact: rightDomain,
    correctActionText: `לתקן את כתובת השולח בתבנית חזרה לדומיין המאומת ${rightDomain}, ולוודא שהמיילים נשלחים בהצלחה`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את התבנית כולה ולבנות אחת חדשה",
      treat_symptom: "לשלוח את המיילים ידנית מתיבת דואר אישית",
      fix_decoy: "לחקור את עדכון עיצוב התבנית",
      busywork_gather_more: "לעבור על כל תבניות המייל בחברה",
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
      { text: "רשומת ה-DMARC חסרה" },
      { text: "כתובת השולח לא מאומתת" },
      {
        text: `כתובת הנמען (contact@${recipientDomain}) נמצאת ברשימת ההשעיה של הספק בעקבות hard bounce קודם, ולכן חסומה מקבלת הודעות`,
        correct: true,
      },
      { text: "שרת ה-SMTP לא מוגדר נכון" },
    ],
    q3Prompt: "איזו כתובת מייל נמצאת ברשימת ההשעיה?",
    q3Fact: `contact@${recipientDomain}`,
    correctActionText: "לוודא מול הלקוח שהכתובת פעילה כעת, ולהסיר אותה מרשימת ההשעיה אצל הספק לפני שליחה חוזרת",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להסיר את כל רשימת ההשעיה בבת אחת כדי לפתור מהר",
      treat_symptom: "לשלוח את המייל שוב ושוב לאותה כתובת",
      fix_decoy: "לבדוק את הגדרות שרת ה-SMTP",
      busywork_gather_more: "לעבור על כל רשימת ההשעיה של השנה האחרונה",
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
