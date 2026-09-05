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
      {
        text: "יש דליפת נתונים מדלי אחסון ציבורי שגורמת להורדות חוזרות ולחיוב עצום ומתמשך על תעבורת רשת יוצאת בכל שעה",
      },
      {
        text: "autoscale נשאר דלוק בסביבת ה-dev מאז בדיקת עומסים לפני 3 שבועות, ויצר הרבה יותר מכונות ממה שנדרש בפועל",
        correct: true,
      },
      {
        text: "עדכון תעודת ה-TLS שבוצע השבוע הפעיל בטעות תהליך רקע כבד שממשיך לצרוך משאבי מחשוב באופן רציף עד עכשיו",
      },
      {
        text: "מישהו שינה בטעות את תעריפי החיוב מול ספק הענן, כך שאותה כמות משאבים בדיוק מחויבת כעת במחיר גבוה פי כמה",
      },
    ],
    q3Prompt: "כמה מכונות פעילות בסביבת ה-dev כרגע?",
    q3Fact: String(instances),
    correctActionText: "לכבות את ה-autoscale בסביבת dev ולהחזיר אותה למספר המכונות הרגיל, ולוודא שהחיוב יורד בהתאם",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל סביבת ה-dev לגמרי כדי לעצור את החיוב מיד, כולל מכונות ונתונים שעדיין בשימוש",
      treat_symptom: "לבקש מהספק זיכוי כספי על החיוב החריג, בלי לכבות את המנגנון שממשיך ליצור מכונות נוספות",
      fix_decoy: "לחקור לעומק את חידוש תעודת ה-TLS מהשבוע, למרות שהוא בוצע בהצלחה וללא שינויי קונפיגורציה",
      busywork_gather_more: "לאסוף את כל היסטוריית החיובים של השנה האחרונה בכל הסביבות לפני שנוגעים בהגדרת ה-autoscale",
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
      {
        text: "autoscale נשאר דלוק בסביבת dev מאז בדיקת עומסים ישנה שנשכחה, ויצר הרבה יותר מכונות ממה שבאמת נדרש כרגע",
      },
      {
        text: "דלי אחסון ציבורי (assets-public) מאפשר לכל אחד להוריד קובץ כבד שוב ושוב, וגורם לחיוב egress עצום",
        correct: true,
      },
      {
        text: "שדרוג גרסת ה-SDK שבוצע השבוע הפעיל בטעות סנכרון רקע כבד שממשיך לצרוך תעבורת רשת בלי הפסקה עד עכשיו",
      },
      {
        text: "מישהו הריץ בדיקת עומסים גדולה בטעות ולא כיבה אותה בסיום כמתוכנן, כך שהיא ממשיכה לצרוך תעבורת רשת מיותרת",
      },
    ],
    q3Prompt: "מה שם דלי האחסון הציבורי?",
    q3Fact: "assets-public",
    correctActionText:
      "לבדוק אילו שירותים אכן צריכים גישה ציבורית לדלי, להגביל אותו לפרטי/עם קישורים חתומים, ולעקוב שה-egress יורד",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את הדלי כולו מיד כדי לעצור את החיוב, בלי לבדוק קודם אילו שירותים בפרודקשן תלויים בו",
      treat_symptom: "לפתוח פנייה לספק ולבקש החזר כספי על החיוב החריג, בלי לתקן את הגדרת הגישה הציבורית של הדלי",
      fix_decoy: "לחקור לעומק את שדרוג ה-SDK שבוצע השבוע, למרות שהחיוב מגיע במפורש מתעבורת egress מהדלי הציבורי",
      busywork_gather_more: "לאסוף רשימה מלאה של כל הדליים בחשבון ולבדוק כל אחד לעומק לפני שמטפלים בזה שכבר ידוע שגורם לבעיה",
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
      {
        text: "דלי אחסון ציבורי מאפשר הורדות חוזרות של קובץ כבד וגורם לחיוב egress עצום ומתמשך, בדומה למקרים קודמים שכבר קרו",
      },
      {
        text: "autoscale בסביבת dev נשאר דלוק מאז בדיקת עומסים ישנה שנשכחה ויצר הרבה יותר מכונות ממה שבאמת נדרש כרגע",
      },
      {
        text: `בדיקת עומסים (load test) שהופעלה לפני ${testDurationH} שעות יצרה 25 מכונות ונשארה פעילה מבלי שכיבו אותה בסיום`,
        correct: true,
      },
      {
        text: "עדכון מערכת ההפעלה שבוצע בפרודקשן השבוע הפעיל בטעות תהליך גיבוי כבד שממשיך לרוץ ברקע ללא הפסקה עד עכשיו",
      },
    ],
    q3Prompt: "מאיזה סוג מכונות הוקמו בבדיקת העומסים?",
    q3Fact: "load-test-runner",
    correctActionText: "לכבות את 25 מכונות ה-load-test-runner שאינן בשימוש ולוודא שהחיוב יורד בהתאם",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לכבות את כל המכונות בחשבון כולל סביבת production, כדי לעצור את החיוב במהירות המרבית",
      treat_symptom: "לבקש החזר כספי מהספק על החיוב החריג, בלי לכבות את המכונות שממשיכות לרוץ ולצבור עלות",
      fix_decoy: "לחקור לעומק את עדכון מערכת ההפעלה בפרודקשן, למרות שהוא דווח כמוצלח וללא קשר למכונות הבדיקה",
      busywork_gather_more: "לבדוק את כל היסטוריית בדיקות העומסים של השנה שעברה בכל הצוותים לפני שמכבים את המכונות הפעילות כרגע",
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
