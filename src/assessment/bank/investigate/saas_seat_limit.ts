// investigate.saas_seat_limit — ASSESSMENT_DESIGN.md §3.3. New employees
// can't be added to a SaaS tool.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "לא מצליחים להוסיף עובדים חדשים לכלי ה-SaaS, מקבלים שגיאה."';

function buildA(rng: Rng): VariantWorld {
  const seatsUsed = rng.nextIntBetween(48, 50);
  const seatsTotal = 50;
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "plan",
        label: "מסך תוכנית ומכסה",
        body: `תוכנית: Business — ${seatsTotal} מקומות\nבשימוש: ${seatsUsed} מתוך ${seatsTotal} (${seatsUsed}/${seatsTotal})`,
      },
      {
        key: "errlog",
        label: "הודעת שגיאה במערכת",
        body: "ERROR: seat_limit_reached — cannot invite new user, upgrade plan or free a seat",
      },
      {
        key: "users",
        label: "רשימת משתמשים",
        body: `${seatsUsed} משתמשים פעילים, מתוכם 6 לא התחברו מעל 4 חודשים`,
      },
      {
        key: "chat",
        label: "צ'אט IT",
        decoy: true,
        body: "יוסי: הדומיין שלנו לא ברשימה המורשית של ה-SSO, לא קשור לזה כנראה.",
      },
    ],
    decisiveArtifactKeyQ1: "plan",
    decisiveArtifactKeyQ3: "plan",
    q1Options: [
      { text: "הדומיין של העובדים החדשים לא מורשה" },
      {
        text: `הגעתם למכסת המקומות של התוכנית (${seatsUsed}/${seatsTotal}); אי אפשר להוסיף עובד חדש בלי לפנות מקום או לשדרג את התוכנית`,
        correct: true,
      },
      { text: "ההזמנות פגות תוקף אחרי 7 ימים" },
      { text: "יש תקלה זמנית בשירות ה-SaaS" },
    ],
    q3Prompt: "כמה מקומות בשימוש מתוך הסך הכול (בפורמט X/Y)?",
    q3Fact: `${seatsUsed}/${seatsTotal}`,
    correctActionText:
      "לדווח למי שמאשר תקציב עם נתוני הניצול (כולל 6 המשתמשים הלא פעילים) ולהציע לפנות מקומות לא בשימוש או לשדרג את התוכנית",
    isEscalationRequired: true,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק משתמשים לא פעילים מיד בלי לבדוק אם הם עדיין צריכים גישה",
      treat_symptom: "לבקש מהעובד החדש לחכות בלי לטפל בבעיה",
      fix_decoy: "לבדוק את רשימת הדומיינים המורשית ב-SSO",
      busywork_gather_more: "לעבור על כל היסטוריית ההתחברויות של כל המשתמשים בשנה האחרונה",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const domain = rng.pick(["example-labs.co.il", "example-new.co.il"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "settings",
        label: "הגדרות הזמנות — SaaS",
        body: `דומיינים מורשים להזמנה: example.co.il\n(עובדים חדשים משתמשים בכתובת ${domain}@... — דומיין שלא ברשימה)`,
      },
      {
        key: "errlog",
        label: "הודעת שגיאה",
        body: "ERROR: domain_not_allowed for invite",
      },
      {
        key: "plan",
        label: "מסך תוכנית ומכסה",
        body: "בשימוש: 30 מתוך 50 מקומות (רחוק מהמכסה)",
      },
      {
        key: "chat",
        label: "צ'אט IT",
        decoy: true,
        body: "מאיה: יש עדכון גרסה לאפליקציה במובייל, לא קשור.",
      },
    ],
    decisiveArtifactKeyQ1: "settings",
    decisiveArtifactKeyQ3: "settings",
    q1Options: [
      { text: "הגעתם למכסת המקומות בתוכנית" },
      {
        text: `רשימת הדומיינים המורשים להזמנה לא כוללת את הדומיין החדש (${domain}) שבו משתמשים העובדים החדשים`,
        correct: true,
      },
      { text: "ההזמנות פגות תוקף מהר מדי" },
      { text: "עדכון גרסת האפליקציה גרם לתקלה" },
    ],
    q3Prompt: "מה הדומיין החדש שאינו ברשימת הדומיינים המורשים?",
    q3Fact: domain,
    correctActionText: `להוסיף את ${domain} לרשימת הדומיינים המורשים להזמנה, ולוודא שההזמנה החדשה מתקבלת`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להסיר את כל הגבלת הדומיינים לצמיתות",
      treat_symptom: "להזמין את העובד ידנית דרך תמיכת הספק בכל פעם",
      fix_decoy: "לבדוק את עדכון גרסת האפליקציה במובייל",
      busywork_gather_more: "לעבור על כל רשימות הדומיינים בכל השירותים בחברה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const sentDaysAgo = rng.nextIntBetween(9, 12);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "invites",
        label: "יומן הזמנות",
        body: `הזמנה נשלחה לעובד/ת חדש/ה לפני ${sentDaysAgo} ימים, סטטוס: פגה (expired)`,
      },
      {
        key: "docs",
        label: "תיעוד הכלי",
        body: 'מתוך התיעוד: "הזמנות שלא אושרו פגות תוקף כעבור 7 ימים ויש לשלוח הזמנה חדשה — אין הארכה אוטומטית."',
      },
      {
        key: "plan",
        label: "מסך תוכנית ומכסה",
        body: "בשימוש: 32 מתוך 50 מקומות (רחוק מהמכסה)",
      },
      {
        key: "chat",
        label: "צ'אט IT",
        decoy: true,
        body: "עידו: יש לנו התראה על ניצול דיסק גבוה בשרת, לא קשור.",
      },
    ],
    decisiveArtifactKeyQ1: "docs",
    decisiveArtifactKeyQ3: "docs",
    q1Options: [
      { text: "הגעתם למכסת המקומות" },
      { text: "הדומיין של העובד לא מורשה" },
      {
        text: `ההזמנה נשלחה לפני ${sentDaysAgo} ימים ופגה תוקף אחרי 7 ימים לפי תיעוד הכלי; אין הארכה אוטומטית`,
        correct: true,
      },
      { text: "יש התראה על ניצול דיסק גבוה שקשורה לתקלה" },
    ],
    q3Prompt: "אחרי כמה ימים פגה הזמנה שלא אושרה, לפי התיעוד?",
    q3Fact: "7",
    correctActionText: "לשלוח הזמנה חדשה לעובד/ת ולוודא שהיא מאושרת תוך פחות מ-7 ימים הפעם",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לשנות את הגדרות תפוגת ההזמנות לכל הארגון בלי לבדוק השלכות",
      treat_symptom: "לבקש מהעובד לנסות להירשם בעצמו בלי הזמנה",
      fix_decoy: "לחקור את ניצול הדיסק הגבוה בשרת",
      busywork_gather_more: "לעבור על כל ההזמנות שנשלחו בשנה האחרונה",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.saas_seat_limit",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: ["a"],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
