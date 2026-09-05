// investigate.duplicate_submissions — ASSESSMENT_DESIGN.md §3.3. Duplicate
// form submissions in DB.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "יש הרבה רשומות כפולות בטבלת ההרשמות מהיומיים האחרונים."';

function buildA(rng: Rng): VariantWorld {
  const timeoutMs = rng.pick([3000, 5000]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "frontend",
        label: "קוד צד לקוח (מקוצר)",
        body: `fetch('/api/signup', {...}).catch(() => fetch('/api/signup', {...}))\n// timeout: ${timeoutMs}ms, ללא idempotency key`,
      },
      {
        key: "serverlog",
        label: "לוג שרת",
        body: `10:02:01  POST /api/signup  email=a@x.com  (מעבד...)\n10:02:0${timeoutMs / 1000 + 1}  POST /api/signup  email=a@x.com  (בקשה שנייה, אותו תוכן)\n10:02:0${timeoutMs / 1000 + 2}  201 created x2`,
      },
      {
        key: "dbrows",
        label: "שורות DB",
        body: "id=501 email=a@x.com created_at=10:02:01\nid=502 email=a@x.com created_at=10:02:04 (זהה לחלוטין)",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "מאיה: עדכנו את עיצוב הטופס השבוע, נראה תקין.",
      },
    ],
    decisiveArtifactKeyQ1: "frontend",
    decisiveArtifactKeyQ3: "dbrows",
    q1Options: [
      {
        text: "יש שני מנויי webhook פעילים שנרשמו בטעות על אותו אירוע הרשמה בהגדרות המערכת החיצונית, כך שכל שליחת טופס בודדת יוצרת שתי רשומות זהות לגמרי במקביל אצל שני המנויים הפעילים",
      },
      {
        text: `הלקוח שולח שוב את הבקשה אוטומטית אחרי timeout של ${timeoutMs}ms בלי לבדוק אם הבקשה הראשונה בכל זאת הצליחה, ובלי מזהה ייחודי (idempotency key) שמונע כפילות בצד השרת`,
        correct: true,
      },
      {
        text: "המשתמש לחץ פעמיים על הכפתור בכוונה ברורה תוך שנייה אחת כדי לוודא שההרשמה שלו נקלטה בהצלחה במערכת, וכך יצר בטעות שתי רשומות זהות לגמרי בטבלה",
      },
      {
        text: "עדכון עיצוב הטופס שבוצע בשקט השבוע על ידי הצוות שינה את מבנה השדות הפנימי ברקע התהליך, וגרם בטעות לשליחה כפולה של אותם נתונים בדיוק לשרת",
      },
    ],
    q3Prompt: "מה מזהה (id) הרשומה הכפולה השנייה בטבלה?",
    q3Fact: "502",
    correctActionText:
      "להוסיף idempotency key לבקשת ההרשמה בצד הלקוח והשרת, כך שבקשה חוזרת לא תיצור רשומה כפולה",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הרשומות הכפולות מיד בלי לגבות אותן קודם ובלי לוודא שאף אחת מהן אינה הרשומה האמיתית היחידה",
      treat_symptom: "לבקש מהצוות למחוק ידנית כפילויות כל בוקר, בלי לתקן את הלקוח שממשיך לשלוח בקשות כפולות",
      fix_decoy: "לחקור לעומק את עדכון עיצוב הטופס מהשבוע, למרות שהקוד מראה בבירור retry אוטומטי ללא idempotency",
      busywork_gather_more: "לעבור על כל הרשומות מהשנה האחרונה בחיפוש כפילויות דומות לפני שמתקנים את מנגנון השליחה החוזרת",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const provider = rng.pick(["form-provider", "crm-webhooks"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "webhooksettings",
        label: `הגדרות webhook — ${provider}`,
        body: "מנוי #1: endpoint=/api/signup, פעיל\nמנוי #2: endpoint=/api/signup, פעיל (נוצר בטעות בזמן בדיקה, לא נמחק)",
      },
      {
        key: "serverlog",
        label: "לוג שרת",
        body: "10:02:01  POST /api/signup  webhook_id=1  email=a@x.com\n10:02:01  POST /api/signup  webhook_id=2  email=a@x.com (אותו תוכן, מנוי אחר)",
      },
      {
        key: "dbrows",
        label: "שורות DB",
        body: "id=501 email=a@x.com source=webhook_1\nid=502 email=a@x.com source=webhook_2",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "יוסי: יש עומס קל בשרת, בודק אם קשור.",
      },
    ],
    decisiveArtifactKeyQ1: "webhooksettings",
    decisiveArtifactKeyQ3: "webhooksettings",
    q1Options: [
      {
        text: "הלקוח שולח בקשה כפולה אוטומטית אחרי timeout מבלי לבדוק אם הבקשה הראשונה בכל זאת הצליחה, וללא מזהה ייחודי idempotency key",
      },
      {
        text: "יש שני מנויי webhook פעילים שמצביעים לאותו endpoint, כך שכל שליחת טופס מגיעה פעמיים ונשמרת פעמיים בטבלה",
        correct: true,
      },
      {
        text: "המשתמש לחץ פעמיים על הכפתור בכוונה תוך שנייה אחת כדי לוודא שההרשמה שלו נקלטה בהצלחה, וכך יצר בטעות שתי רשומות זהות",
      },
      {
        text: "עומס גבוה בשרת בשעת שיא גרם לו לעבד את אותה בקשה פעמיים ברצף מהיר, ולכתוב שתי רשומות זהות לגמרי לטבלה",
      },
    ],
    q3Prompt: "איזה מנוי webhook כפול וצריך הסרה?",
    q3Fact: "מנוי #2",
    correctActionText: `להשבית או למחוק את מנוי ה-webhook הכפול (מנוי #2) ב-${provider}, ולוודא שכל שליחה יוצרת רשומה אחת בלבד`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להשבית את שני מנויי ה-webhook יחד ולאבד בכך כל קליטת הרשמות עד שמישהו יגדיר אותם מחדש מאפס",
      treat_symptom: "למחוק כפילויות ידנית מדי בוקר מהטבלה, בלי להסיר את מנוי ה-webhook הכפול שממשיך ליצור אותן",
      fix_decoy: "לחקור לעומק את העומס הקל שדווח בשרת, למרות שההגדרות מראות בבירור שני מנויים על אותו endpoint",
      busywork_gather_more: "לעבור על כל הגדרות ה-webhook בכל המערכות בחברה לפני שמסירים את המנוי הכפול שכבר אותר",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const gapMs = rng.pick([180, 220, 250, 300]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "frontend",
        label: "קוד צד לקוח (מקוצר)",
        body: "<button onClick={submit}>שלח</button>\n// הכפתור לא מושבת (disabled) אחרי לחיצה",
      },
      {
        key: "serverlog",
        label: "לוג שרת",
        body: `10:02:01.100  POST /api/signup email=a@x.com\n10:02:01.${gapMs}  POST /api/signup email=a@x.com (${gapMs - 100}ms אחרי, אותו תוכן בדיוק)`,
      },
      {
        key: "dbrows",
        label: "שורות DB",
        body: `id=501 email=a@x.com created_at=10:02:01.100\nid=502 email=a@x.com created_at=10:02:01.${gapMs}`,
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "דנה: הוספנו שדה חדש לטופס השבוע, לא אמור להשפיע.",
      },
    ],
    decisiveArtifactKeyQ1: "frontend",
    decisiveArtifactKeyQ3: "serverlog",
    q1Options: [
      {
        text: "יש שני מנויי webhook פעילים שמצביעים בטעות לאותו endpoint בדיוק, כך שכל שליחת טופס בודדת נשמרת פעמיים בטבלה",
      },
      {
        text: "הלקוח עושה retry אוטומטי אחרי timeout בלי לבדוק אם הבקשה הראשונה כבר הצליחה בפועל, וללא מזהה ייחודי idempotency key",
      },
      {
        text: "כפתור השליחה לא מושבת אחרי לחיצה, כך שלחיצה כפולה מהירה (או לחיצה כפולה בטעות) שולחת שתי בקשות זהות תוך פחות משנייה",
        correct: true,
      },
      {
        text: "השדה החדש שנוסף לטופס השבוע גורם לו בטעות להישלח פעמיים ברקע בכל פעם שהמשתמש ממלא ושולח אותו במלואו",
      },
    ],
    q3Prompt: "כמה זמן (מ״ש) עבר בין שתי הבקשות הזהות?",
    q3Fact: String(gapMs - 100),
    correctActionText: "להשבית את כפתור השליחה מיד עם הלחיצה הראשונה עד לקבלת תשובה מהשרת, כדי למנוע שליחה כפולה",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להסיר את הטופס מהאתר לגמרי עד לתיקון, ולמנוע בכך מכל המשתמשים להירשם באותו זמן",
      treat_symptom: "למחוק כפילויות ידנית מהטבלה כל בוקר, בלי להשבית את כפתור השליחה שממשיך ליצור אותן",
      fix_decoy: "לחקור לעומק את השדה החדש שנוסף לטופס השבוע, למרות שהתזמון בלוג מצביע במפורש על לחיצה כפולה מהירה",
      busywork_gather_more: "לעבור על כל טפסי האתר בחיפוש כפתורים דומים לפני שמתקנים את זה שכבר דווח עליו",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.duplicate_submissions",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
