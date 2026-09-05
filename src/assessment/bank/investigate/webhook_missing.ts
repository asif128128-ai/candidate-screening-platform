// investigate.webhook_missing — ASSESSMENT_DESIGN.md §3.3, worked example 6.
// Orders from the online store stopped appearing in the CRM since yesterday.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { NAME_POOL } from "../helpers";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

function buildA(rng: Rng): VariantWorld {
  const orderFail1 = rng.nextIntBetween(77300, 77399);
  const orderFail2 = orderFail1 + 1;
  const orderFail3 = orderFail1 + 2;
  const person = rng.pick(NAME_POOL);
  const secretSuffix = rng.nextIntBetween(1000, 9999).toString(16);

  return {
    ticket: `כרטיס תמיכה — "מאתמול בערב הזמנות מהחנות לא מגיעות ל-CRM. הלקוחות משלמים, אבל אין רשומה. דחוף."`,
    tabs: [
      {
        key: "log",
        label: "Logs – integration",
        body:
          `18:42:11  POST /webhooks/store  200  order=A-${orderFail1 - 2}  sig=ok\n` +
          `19:05:37  POST /webhooks/store  200  order=A-${orderFail1 - 1}  sig=ok\n` +
          `21:14:02  POST /webhooks/store  401  order=A-${orderFail1}  sig=invalid\n` +
          `21:14:09  POST /webhooks/store  401  order=A-${orderFail1}  sig=invalid (retry 1)\n` +
          `22:30:55  POST /webhooks/store  401  order=A-${orderFail2}  sig=invalid\n` +
          `23:02:10  POST /webhooks/store  401  order=A-${orderFail3}  sig=invalid\n` +
          `08:10:20  GET  /health           200`,
      },
      {
        key: "settings",
        label: "Webhook settings (Store)",
        body:
          `Endpoint: https://crm-bridge.example.co.il/webhooks/store\nStatus: Active\n` +
          `Signing secret: whsec_…${secretSuffix}\nLast rotated: 21:02 by ${person}@store.example.co.il`,
      },
      {
        key: "docs",
        label: "API docs – Store webhooks",
        body:
          'כל בקשה נושאת X-Store-Signature, HMAC-SHA256 של הגוף באמצעות ה-signing secret הנוכחי. סבב (rotation) של הסוד מבטל מיידית את הקודם.',
      },
      {
        key: "deploy",
        label: "Deploy notes",
        decoy: true,
        body: "2026-09-02 – שדרוג Node ל-22, ללא שינויי קונפיגורציה. יוסי: ה-health של הגשר ירוק.",
      },
    ],
    decisiveArtifactKeyQ1: "settings",
    decisiveArtifactKeyQ3: "log",
    q1Options: [
      {
        text: "שרת הגשר בין החנות ל-CRM קרס בשקט אחרי עדכון לילי ולא עלה בחזרה, כך שכל הבקשות הנכנסות מהחנות נענות בשגיאת חיבור ולא בקוד סטטוס תקין",
      },
      {
        text: "ה-secret לחתימת ה-webhook הוחלף בצד החנות בעדכון האחרון, אבל הגשר ממשיך לאמת חתימות מול הסוד הישן שכבר אינו בתוקף, ולכן כל הבקשות נדחות",
        correct: true,
      },
      {
        text: "שדרוג ה-Node שבוצע השבוע שינה את אופן פענוח גוף הבקשה, כך שהגשר דוחה בקשות תקינות בגלל שגיאת פרסור JSON ולא בגלל בעיית אימות כלשהי",
      },
      {
        text: "כתובת ה-endpoint שהוגדרה בצד החנות מצביעה לנתיב ישן שכבר לא קיים בגשר מאז ניקוי נתיבים אחרון בפריסה, ולכן כל הבקשות מקבלות שגיאת נתיב לא נמצא",
      },
      {
        text: "מודול שליחת ה-webhooks בצד החנות הושבת בטעות בעדכון האחרון שם, כך שההזמנות כלל לא נשלחות יותר לגשר ולא מגיעות אליו בכלל בשום צורה",
      },
    ],
    q3Prompt: "מה מספר ההזמנה הראשונה שנכשלה?",
    q3Fact: `A-${orderFail1}`,
    correctActionText: "לעדכן את ה-secret החדש בהגדרות הגשר ולוודא שההזמנה הבאה מתקבלת ב-200",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לעשות rollback מיידי לשדרוג ה-Node של אתמול, בלי לבדוק קודם אם זה בכלל קשור לתקלה בחתימת ה-webhook",
      treat_symptom: "לבקש מהחנות לשלוח מחדש ידנית את כל ההזמנות מאתמול בערב, בלי לתקן את מה שגרם לדחייה מלכתחילה",
      fix_decoy: "לבדוק לעומק את שדרוג ה-Node ולוודא שהוא לא שבר משהו אחר במערכת, למרות שהלוג לא מצביע על קשר בין השניים",
      busywork_gather_more: "להוריד את כל ה-Logs של השבוע האחרון ולעבור עליהם שורה-שורה לפני שנוגעים בהגדרות הגשר",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const orderFail = rng.nextIntBetween(77300, 77399);
  const oldPath = "/webhooks/store";
  const newPath = "/webhooks/store/v2";

  return {
    ticket: `כרטיס תמיכה — "מאתמול בערב הזמנות מהחנות לא מגיעות ל-CRM. הלקוחות משלמים, אבל אין רשומה. דחוף."`,
    tabs: [
      {
        key: "log",
        label: "Logs – integration",
        body:
          `18:42:11  POST ${oldPath}  200  order=A-${orderFail - 2}  sig=ok\n` +
          `19:05:37  POST ${oldPath}  200  order=A-${orderFail - 1}  sig=ok\n` +
          `21:00:03  POST ${oldPath}  404  order=A-${orderFail}\n` +
          `21:00:11  POST ${oldPath}  404  order=A-${orderFail} (retry 1)\n` +
          `21:30:44  POST ${oldPath}  404  order=A-${orderFail + 1}\n` +
          `08:10:20  GET  /health           200`,
      },
      {
        key: "deploynotes",
        label: "Deploy notes",
        body: `20:55 — פריסה 2.6.0: העברת מסלול ה-webhook הנכנס מ-${oldPath} ל-${newPath} (חלק מניקוי נתיבים ישנים).`,
      },
      {
        key: "settings",
        label: "Webhook settings (Store)",
        body: `Endpoint: https://crm-bridge.example.co.il${oldPath}\nStatus: Active\nSigning secret: whsec_…aa11\nLast rotated: לפני 40 יום`,
      },
      {
        key: "docs",
        label: "API docs – Store webhooks",
        body:
          'כל בקשה נושאת X-Store-Signature, HMAC-SHA256 של הגוף באמצעות ה-signing secret הנוכחי. סבב של הסוד מבטל מיידית את הקודם.',
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: `דנה: מישהו ראה שה-CPU של השרת עלה קצת אתמול בערב? כנראה שום דבר.`,
      },
    ],
    decisiveArtifactKeyQ1: "deploynotes",
    decisiveArtifactKeyQ3: "log",
    q1Options: [
      {
        text: "ה-secret לחתימת ה-webhook הוחלף בצד החנות אחרי הפריסה של אתמול, והגשר עדיין ממשיך לאמת כל בקשה חדשה מול המפתח הישן שכבר אינו תקף כלל, ולכן כל הבקשות נדחות בטעות",
      },
      {
        text: `הפריסה האחרונה שינתה את נתיב ה-webhook הנכנס ל-${newPath}, אבל הגדרת ה-endpoint בצד החנות עדיין מצביעה ל-${oldPath} הישן, ולכן כל הבקשות מקבלות 404`,
        correct: true,
      },
      {
        text: "עלייה חדה ב-CPU של השרת בשעות הערב גרמה לו לדחות בקשות נכנסות באופן זמני וחוזר עד שהעומס ירד, וזה מסביר לכאורה את הכשלים שנרשמו בלוג האינטגרציה",
      },
      {
        text: "מודול שליחת ה-webhooks בצד החנות הושבת לגמרי בטעות בעדכון האחרון שם, כך שהזמנות חדשות כלל לא נשלחות יותר מהחנות אל הגשר בשום שלב בתהליך",
      },
    ],
    q3Prompt: "מה מספר ההזמנה שנכשלה?",
    q3Fact: `A-${orderFail}`,
    correctActionText: `לעדכן את כתובת ה-endpoint בהגדרות החנות ל-${newPath} ולוודא שההזמנה הבאה מתקבלת ב-200`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לעשות rollback מלא לפריסה 2.6.0, כולל כל שאר השינויים שבה, בלי לבודד קודם רק את שינוי הנתיב",
      treat_symptom: "לבקש מהחנות לשלוח מחדש ידנית את כל ההזמנות מאתמול בערב במקום לתקן את כתובת ה-endpoint שגורמת לכשל",
      fix_decoy: "לחקור לעומק את עליית ה-CPU בשרת לפני שממשיכים, למרות שהלוג מצביע במפורש על שגיאת נתיב ולא על עומס",
      busywork_gather_more: "לאסוף את כל ה-Deploy notes של החודש האחרון ולנתח אותם אחד-אחד לפני שנוגעים בהגדרת ה-endpoint",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const orderFail = rng.nextIntBetween(77300, 77399);
  const expiredAgo = rng.nextIntBetween(1, 3);

  return {
    ticket: `כרטיס תמיכה — "מאתמול בערב הזמנות מהחנות לא מגיעות ל-CRM. הלקוחות משלמים, אבל אין רשומה. דחוף."`,
    tabs: [
      {
        key: "log",
        label: "Logs – integration",
        body:
          `18:42:11  POST /webhooks/store  200  order=A-${orderFail - 2}  sig=ok  crm_write=ok\n` +
          `19:05:37  POST /webhooks/store  200  order=A-${orderFail - 1}  sig=ok  crm_write=ok\n` +
          `21:14:02  POST /webhooks/store  200  order=A-${orderFail}  sig=ok  crm_write=FAILED (401 from CRM API)\n` +
          `21:14:09  POST /webhooks/store  200  order=A-${orderFail}  sig=ok  crm_write=FAILED (retry 1)\n` +
          `22:30:55  POST /webhooks/store  200  order=A-${orderFail + 1}  sig=ok  crm_write=FAILED (401 from CRM API)`,
      },
      {
        key: "crmkeys",
        label: "CRM – API keys",
        body: `מפתח API בשימוש: crm_live_…7f2\nתוקף: פג לפני ${expiredAgo} ימים\nבעלים: צוות ה-CRM (חשבון ספק חיצוני)`,
      },
      {
        key: "docs",
        label: "API docs – CRM",
        body:
          'מתוך תיעוד ה-CRM: "מפתחות API שפגו מחזירים 401 על כל קריאה. חידוש מפתח דורש אישור מנהל החשבון אצל הספק."',
      },
      {
        key: "settings",
        label: "Webhook settings (Store)",
        body: "Endpoint: https://crm-bridge.example.co.il/webhooks/store\nStatus: Active\nLast rotated: לפני 90 יום",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "רועי: מישהו עדכן את ה-DNS של הדומיין הפנימי? נראה תקין אצלי.",
      },
    ],
    decisiveArtifactKeyQ1: "crmkeys",
    decisiveArtifactKeyQ3: "crmkeys",
    q1Options: [
      {
        text: "ה-secret לחתימת ה-webhook פג תוקף אצל החנות ולא חודש בזמן, ולכן כל בקשה נדחית עוד לפני שהיא מגיעה לשלב הכתיבה ל-CRM",
      },
      {
        text: "הגדרת ה-endpoint בצד החנות שגויה ומצביעה לכתובת ישנה של הגשר שכבר לא בשימוש, כך שהבקשות כלל לא מגיעות אליו",
      },
      {
        text: "מפתח ה-API מול ה-CRM פג תוקף, ולכן הכתיבה ל-CRM נכשלת למרות שה-webhook עצמו מתקבל ומאומת בהצלחה מצד החנות",
        correct: true,
      },
      {
        text: "רשומת ה-DNS של הדומיין הפנימי השתנתה בטעות אתמול בלילה, כך שהבקשות מהחנות מגיעות לשרת שגוי ולא לגשר האמיתי",
      },
    ],
    q3Prompt: "מה מזהה מפתח ה-API שפג תוקפו?",
    q3Fact: `crm_live_…7f2`,
    correctActionText:
      "לדווח לצוות ה-CRM (בעלי החשבון) עם הראיות מהלוג ותוקף המפתח, ולבקש חידוש מפתח API בדחיפות",
    isEscalationRequired: true,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל האינטגרציה עם ה-CRM ולהקים אותה מחדש מאפס, בלי לבדוק קודם אם זו רק בעיית מפתח",
      treat_symptom: "לבקש מהחנות לשלוח שוב ידנית את כל ההזמנות שנכשלו, בלי לתקן את מפתח ה-API שגורם לכשל בכתיבה",
      fix_decoy: "לבדוק לעומק את רשומות ה-DNS של הדומיין הפנימי, למרות שהלוג מראה שה-webhook עצמו מתקבל בהצלחה",
      busywork_gather_more: "לאסוף היסטוריית מפתחות API מלאה של השנה האחרונה בכל המערכות לפני שפועלים על החידוש הדחוף",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.webhook_missing",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: ["c"],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
