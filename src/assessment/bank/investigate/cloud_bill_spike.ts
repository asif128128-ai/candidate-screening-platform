// investigate.cloud_bill_spike — ASSESSMENT_DESIGN.md §3.3. Cloud bill
// tripled this month.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "חשבון הענן החודש גבוה פי 3 מהרגיל. אף אחד לא זוכר לאשר שינוי כזה."';

function buildA(rng: Rng): VariantWorld {
  const instances = rng.nextIntBetween(8, 14);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "billing",
        label: "פירוט חיוב",
        body: `Compute: 2,400 ₪ (רגיל: 800 ₪)\nStorage: 150 ₪\nNetwork: 90 ₪`,
      },
      {
        key: "instances",
        label: "רשימת מכונות פעילות",
        body: `סביבת dev: ${instances} מכונות פעילות (רגיל: 2-3)\nסביבת prod: 4 מכונות (רגיל)`,
      },
      {
        key: "autoscale",
        label: "הגדרת autoscale — dev",
        body: `Autoscale: ON, min=2, max=20\n(הופעל לפני 3 שבועות לצורך בדיקת עומסים חד-פעמית, לא כובה בסיום)`,
      },
      {
        key: "deploy",
        label: "לוג פעילות",
        decoy: true,
        body: "עדכון תעודת TLS בוצע בהצלחה השבוע.",
      },
    ],
    decisiveArtifactKeyQ1: "autoscale",
    decisiveArtifactKeyQ3: "instances",
    q1Options: [
      { text: "יש דליפת נתונים מדלי אחסון ציבורי" },
      {
        text: "autoscale נשאר דלוק בסביבת ה-dev מאז בדיקת עומסים לפני 3 שבועות, ויצר הרבה יותר מכונות ממה שנדרש",
        correct: true,
      },
      { text: "עדכון תעודת TLS גרם לחיוב נוסף" },
      { text: "מישהו שינה את תעריפי הענן" },
    ],
    q3Prompt: "כמה מכונות פעילות בסביבת ה-dev כרגע?",
    q3Fact: String(instances),
    correctActionText: "לכבות את ה-autoscale בסביבת dev ולהחזיר אותה למספר המכונות הרגיל, ולוודא שהחיוב יורד בהתאם",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל סביבת ה-dev לגמרי",
      treat_symptom: "לבקש מהספק זיכוי כספי בלי לתקן את הסיבה",
      fix_decoy: "לחקור את חידוש תעודת ה-TLS",
      busywork_gather_more: "לאסוף את כל היסטוריית החיובים של השנה האחרונה לפני שנוגעים בהגדרות",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const egressGb = rng.nextIntBetween(800, 2000);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "billing",
        label: "פירוט חיוב",
        body: `Compute: 900 ₪ (רגיל)\nStorage: 200 ₪\nNetwork egress: 2,600 ₪ (רגיל: 150 ₪)`,
      },
      {
        key: "buckets",
        label: "רשימת דליי אחסון",
        body: `assets-public: גישה = ציבורית (public), נפח יוצא החודש: ${egressGb} GB\nbackups-private: גישה = פרטית, נפח יוצא: 5 GB`,
      },
      {
        key: "accesslog",
        label: "לוג גישה — הדלי הציבורי",
        body: "אלפי בקשות הורדה מכתובות IP לא מוכרות, קובץ יחיד בגודל 800MB שהורד אלפי פעמים",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "יוסי: שדרגנו את גרסת ה-SDK, נראה תקין.",
      },
    ],
    decisiveArtifactKeyQ1: "buckets",
    decisiveArtifactKeyQ3: "buckets",
    q1Options: [
      { text: "autoscale נשאר דלוק בסביבת dev" },
      {
        text: "דלי אחסון ציבורי (assets-public) מאפשר לכל אחד להוריד קובץ כבד שוב ושוב, וגורם לחיוב egress עצום",
        correct: true,
      },
      { text: "שדרוג ה-SDK גרם לחיוב נוסף" },
      { text: "מישהו הריץ בדיקת עומסים בטעות" },
    ],
    q3Prompt: "מה שם דלי האחסון הציבורי?",
    q3Fact: "assets-public",
    correctActionText:
      "לבדוק אילו שירותים אכן צריכים גישה ציבורית לדלי, להגביל אותו לפרטי/עם קישורים חתומים, ולעקוב שה-egress יורד",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הדלי כולו מיד בלי לבדוק תלויות",
      treat_symptom: "לפתוח פנייה לספק לבקש החזר כספי בלבד",
      fix_decoy: "לחקור את שדרוג ה-SDK",
      busywork_gather_more: "לאסוף רשימה של כל הדליים בחשבון לפני שבודקים את זה שגורם לבעיה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const testDurationH = rng.nextIntBetween(20, 40);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "billing",
        label: "פירוט חיוב",
        body: "Compute: 2,900 ₪ (רגיל: 900 ₪)\nStorage: 140 ₪",
      },
      {
        key: "activity",
        label: "יומן פעילות ענן",
        body: `לפני ${testDurationH} שעות: הוקמו 25 מכונות מסוג load-test-runner על ידי חשבון ci-bot. עדיין פעילות.`,
      },
      {
        key: "instances",
        label: "רשימת מכונות פעילות",
        body: "25 מכונות מסוג לא רגיל (לא בשימוש, CPU ~0%), 4 מכונות production רגילות",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "מאיה: עדכנו את גרסת מערכת ההפעלה בשרתי הפרודקשן בהצלחה.",
      },
    ],
    decisiveArtifactKeyQ1: "activity",
    decisiveArtifactKeyQ3: "activity",
    q1Options: [
      { text: "דלי אחסון ציבורי גורם לחיוב egress" },
      { text: "autoscale בסביבת dev לא כובה" },
      {
        text: `בדיקת עומסים (load test) שהופעלה לפני ${testDurationH} שעות יצרה 25 מכונות ונשארה פעילה מבלי שכיבו אותה בסיום`,
        correct: true,
      },
      { text: "עדכון מערכת ההפעלה בפרודקשן גרם לחיוב נוסף" },
    ],
    q3Prompt: "מאיזה סוג מכונות הוקמו בבדיקת העומסים?",
    q3Fact: "load-test-runner",
    correctActionText: "לכבות את 25 מכונות ה-load-test-runner שאינן בשימוש ולוודא שהחיוב יורד בהתאם",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לכבות את כל המכונות בחשבון כולל production",
      treat_symptom: "לבקש החזר כספי מהספק בלי לכבות את המכונות",
      fix_decoy: "לחקור את עדכון מערכת ההפעלה בפרודקשן",
      busywork_gather_more: "לבדוק את כל היסטוריית בדיקות העומסים של השנה שעברה",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.cloud_bill_spike",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
