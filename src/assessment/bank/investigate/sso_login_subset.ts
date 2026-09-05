// investigate.sso_login_subset — ASSESSMENT_DESIGN.md §3.3. Some employees
// can't log in to a SaaS since Monday.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "כמה עובדים לא מצליחים להתחבר לכלי ה-SaaS מאז יום שני. אחרים מצליחים בלי בעיה."';

function buildA(rng: Rng): VariantWorld {
  const domainOld = "example.co.il";
  const domainNew = rng.pick(["example-labs.co.il", "example-tech.co.il"]);

  return {
    ticket: TICKET,
    tabs: [
      {
        key: "users",
        label: "טבלת משתמשים חסומים",
        body: `דנה   dana@${domainNew}    נכשל\nיוסי   yossi@${domainOld}   הצליח\nמאיה   maya@${domainNew}    נכשל\nאורי   ori@${domainOld}     הצליח`,
      },
      {
        key: "idp",
        label: "הגדרות IdP — דומיינים מורשים",
        body: `דומיינים מורשים לכניסה: ${domainOld}\n(עודכן לאחרונה: לפני 3 חודשים)`,
      },
      {
        key: "errlog",
        label: "לוג שגיאות אימות",
        body: `יום שני 09:14  dana@${domainNew}  DENIED domain_not_allowed\nיום שני 09:20  maya@${domainNew}  DENIED domain_not_allowed\nיום שני 09:31  yossi@${domainOld}  OK`,
      },
      {
        key: "chat",
        label: "צ'אט IT",
        decoy: true,
        body: "עידו: שמתם לב שהאתר קצת איטי היום? כנראה עומס רגיל של תחילת שבוע.",
      },
    ],
    decisiveArtifactKeyQ1: "idp",
    decisiveArtifactKeyQ3: "idp",
    q1Options: [
      {
        text: "הסיסמאות של כל העובדים שלא מצליחים להתחבר פגו בדיוק בו-זמנית ביום שני בבוקר המוקדם, וזו הסיבה המשותפת לכשל שלהם",
      },
      {
        text: `הדומיין החדש (${domainNew}) לא נמצא ברשימת הדומיינים המורשים ב-IdP, ולכן כל בקשת התחברות ממנו נדחית מיד`,
        correct: true,
      },
      {
        text: "שרת ה-IdP איטי היום בצורה חריגה בגלל עומס גבוה מהרגיל, וזה גורם לחלק מהבקשות להיכשל באופן אקראי לגמרי",
      },
      {
        text: "יש תקלה כללית ולא ברורה בשירות ה-SaaS עצמו שגורמת לכשלי התחברות אקראיים אצל חלק מהעובדים בארגון",
      },
    ],
    q3Prompt: "לפני כמה זמן עודכנה לאחרונה רשימת הדומיינים המורשים ב-IdP?",
    q3Fact: "3 חודשים",
    correctActionText: `להוסיף את ${domainNew} לרשימת הדומיינים המורשים ב-IdP ולוודא שהעובדים החסומים מצליחים להתחבר`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את חשבונות המשתמשים החסומים וליצור חשבונות חדשים, במקום להוסיף את הדומיין לרשימה המורשית",
      treat_symptom: "לבקש מהעובדים לנסות להתחבר שוב כמה פעמים, בלי לתקן את רשימת הדומיינים שגורמת לדחייה",
      fix_decoy: "לחקור לעומק את איטיות האתר שדווחה בצ'אט, למרות שלוג האימות מצביע במפורש על דומיין לא מורשה",
      busywork_gather_more: "לאסוף רשימה של כל העובדים בחברה ולבדוק כל אחד לפני שמוסיפים את הדומיין שכבר אותר כחסר",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const groupOld = "employees-il";
  const groupNew = rng.pick(["staff-il", "team-il"]);

  return {
    ticket: TICKET,
    tabs: [
      {
        key: "users",
        label: "טבלת משתמשים חסומים",
        body: "דנה   group=staff-il      נכשל\nיוסי   group=employees-il  הצליח\nמאיה   group=staff-il      נכשל",
      },
      {
        key: "mapping",
        label: "מיפוי קבוצות (IdP -> SaaS)",
        body: `${groupOld} -> Standard User\n(שם הקבוצה ${groupOld} שונה ל-${groupNew} ביום שני, אבל המיפוי לא עודכן)`,
      },
      {
        key: "errlog",
        label: "לוג שגיאות אימות",
        body: `יום שני 08:55  group=${groupNew}  DENIED no_role_mapping\nיום שני 09:02  group=employees-il  OK`,
      },
      {
        key: "billing",
        label: "חשבונית SaaS",
        decoy: true,
        body: "חשבונית חודשית שולמה בזמן, ללא חריגות.",
      },
    ],
    decisiveArtifactKeyQ1: "mapping",
    decisiveArtifactKeyQ3: "mapping",
    q1Options: [
      {
        text: "הדומיין של העובדים החסומים לא נמצא ברשימת הדומיינים המורשים ב-IdP, ולכן ההתחברות שלהם נדחית",
      },
      {
        text: `קבוצת ה-IdP שונתה שם ל-${groupNew} ביום שני, אבל מיפוי ההרשאות ב-SaaS עדיין מצביע לשם הישן`,
        correct: true,
      },
      {
        text: "החשבונית החודשית של השירות לא שולמה בזמן והחשבון הוקפא, וזו הסיבה שחלק מהעובדים לא מצליחים להתחבר",
      },
      {
        text: "יש תקלה כללית בשירות ה-IdP שגורמת לכשלי אימות אקראיים אצל חלק מהעובדים ביום שני",
      },
    ],
    q3Prompt: `לאיזה role ב-SaaS ממופה הקבוצה הישנה (${groupOld}) לפי מסך המיפוי?`,
    q3Fact: "Standard User",
    correctActionText: `לעדכן את מיפוי הקבוצות כך ש-${groupNew} ימופה ל-Standard User, ולוודא שהעובדים החסומים מצליחים להתחבר`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הקבוצה הישנה מה-IdP לגמרי, במקום פשוט לעדכן את מיפוי ההרשאות לשם החדש שלה",
      treat_symptom: "לבקש מהעובדים החסומים להתחבר עם חשבון אישי אחר, במקום לתקן את מיפוי הקבוצות ב-SaaS",
      fix_decoy: "לבדוק לעומק את פרטי החיוב של השירות, למרות שהחשבונית מוצגת כמשולמת בזמן וללא חריגות",
      busywork_gather_more: "לאסוף את כל היסטוריית שינויי הקבוצות של השנה האחרונה לפני שמעדכנים את המיפוי שכבר אותר כשגוי",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const group = rng.pick(["field-sales", "ops-team"]);

  return {
    ticket: TICKET,
    tabs: [
      {
        key: "users",
        label: "טבלת משתמשים חסומים",
        body: `דנה   group=${group}  נכשל (MFA required)\nיוסי   group=hq       הצליח`,
      },
      {
        key: "policy",
        label: "מדיניות אבטחה — IdP",
        body: `מיום שני: אכיפת MFA חובה עבור קבוצת ${group} (הוחלט אחרי אירוע אבטחה בשבוע שעבר). חברי הקבוצה טרם נרשמו ל-MFA.`,
      },
      {
        key: "errlog",
        label: "לוג שגיאות אימות",
        body: `יום שני 10:02  group=${group}  DENIED mfa_required_not_enrolled`,
      },
      {
        key: "chat",
        label: "צ'אט IT",
        decoy: true,
        body: "מאיה: יש עדכון גרסה לדפדפן שרץ אצל כולם? לא קשור כנראה.",
      },
    ],
    decisiveArtifactKeyQ1: "policy",
    decisiveArtifactKeyQ3: "policy",
    q1Options: [
      {
        text: `הדומיין של קבוצת ${group} לא נמצא ברשימת הדומיינים המורשים ב-IdP, ולכן ההתחברות שלהם נדחית`,
      },
      {
        text: "מיפוי הקבוצות בין ה-IdP ל-SaaS שגוי ומצביע לתפקיד שאינו קיים, וזו הסיבה לכשל ההתחברות",
      },
      {
        text: `מדיניות אבטחה חדשה מאלצת MFA על קבוצת ${group}, וחבריה עדיין לא נרשמו ל-MFA`,
        correct: true,
      },
      {
        text: "עדכון גרסת דפדפן שרץ אצל כל הצוות גרם לכשל בתהליך ההתחברות אצל חלק מהעובדים בקבוצה",
      },
    ],
    q3Prompt: "מדוע הוחלט לאכוף MFA על הקבוצה, לפי מדיניות האבטחה?",
    q3Fact: "אירוע אבטחה",
    correctActionText:
      "לדווח לצוות האבטחה עם הראיות (מדיניות ה-MFA והעובדים החסומים) ולהציע לתאם מועד הרשמה מבוקר ל-MFA לקבוצה",
    isEscalationRequired: true,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לבטל את מדיניות ה-MFA לגמרי כדי לפתור מיד, ולחזור בכך על החולשה שגרמה לאירוע האבטחה",
      treat_symptom: "לבקש מהעובדים לנסות להתחבר שוב מדפדפן אחר, במקום לטפל בדרישת ה-MFA שגורמת לחסימה",
      fix_decoy: "לבדוק אם יש בעיה בגרסת הדפדפן שרץ אצל הצוות, למרות שמדיניות האבטחה מסבירה במפורש את הסיבה",
      busywork_gather_more: "לאסוף רשימה של כל מדיניות האבטחה שהוגדרו השנה בכל הקבוצות לפני שמדווחים על המקרה הנוכחי",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.sso_login_subset",
  version: 2,
  causeVariants: ["a", "b", "c"],
  escalationCauses: ["c"],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
