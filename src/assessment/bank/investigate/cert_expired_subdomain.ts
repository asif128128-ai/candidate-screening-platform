// investigate.cert_expired_subdomain — ASSESSMENT_DESIGN.md §3.3. One
// subdomain shows a browser security error since this morning.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "מאז הבוקר, כניסה ל-portal.example.co.il מציגה שגיאת אבטחה בדפדפן."';

function buildA(rng: Rng): VariantWorld {
  const daysAgo = rng.nextIntBetween(0, 1);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "cert",
        label: "פרטי תעודה — portal.example.co.il",
        body: `תוקף: פג ${daysAgo === 0 ? "היום" : "אתמול"} ב-03:00\nמנפיק: Let's Encrypt\nחידוש אוטומטי: כבוי (הוגדר ידנית לפני 90 יום)`,
      },
      {
        key: "dns",
        label: "רשומות DNS",
        body: "portal.example.co.il  A  203.0.113.10 (תקין, לא השתנה)",
      },
      {
        key: "proxy",
        label: "כללי proxy",
        decoy: true,
        body: "אין כללי redirect חדשים בשבוע האחרון.",
      },
      {
        key: "browsererr",
        label: "טקסט שגיאת הדפדפן",
        body: "NET::ERR_CERT_DATE_INVALID — התעודה של אתר זה פגה.",
      },
    ],
    decisiveArtifactKeyQ1: "cert",
    decisiveArtifactKeyQ3: "cert",
    q1Options: [
      {
        text: "רשומת ה-DNS של תת-הדומיין מצביעה בטעות לשרת ישן שהוצא משימוש, ולכן הדפדפן מתחבר לתעודה שלא שייכת לכתובת המבוקשת",
      },
      {
        text: "תעודת ה-TLS של תת-הדומיין פגה כי החידוש האוטומטי כובה ידנית לפני 90 יום, ומאז אף אחד לא חידש אותה ידנית",
        correct: true,
      },
      {
        text: "כלל redirect חדש שנוסף לאחרונה יוצר לולאת הפניה בין הדומיין לעצמו, וזו הסיבה לשגיאת האבטחה בדפדפן",
      },
      {
        text: "שרת ה-DNS הפנימי נפל הבוקר ולא עונה לשאילתות, כך שהדפדפן לא מצליח לפתור את הכתובת כלל",
      },
    ],
    q3Prompt: "מי מנפיק התעודה?",
    q3Fact: "Let's Encrypt",
    correctActionText: "לחדש את התעודה מיד ולהפעיל מחדש את החידוש האוטומטי כדי שזה לא יקרה שוב",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להסיר את תת-הדומיין מהשירות באופן מיידי עד לבירור מלא, ולנתק בכך גישה לכל המשתמשים שלו",
      treat_symptom: "לבקש מהמשתמשים ללחוץ 'המשך בכל זאת' בהתראת הדפדפן במקום לטפל בתעודה עצמה",
      fix_decoy: "לבדוק לעומק את כללי ה-redirect בפרוקסי, למרות שהודעת השגיאה מצביעה במפורש על בעיית תוקף תעודה",
      busywork_gather_more: "לבדוק את תוקף כל התעודות בכל תת-הדומיינים בחברה לפני שמחדשים את זו שכבר ידוע שפגה",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const oldIp = "203.0.113.10";
  const newIp = rng.pick(["198.51.100.24", "198.51.100.55"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "dns",
        label: "רשומות DNS",
        body: `portal.example.co.il  A  ${oldIp} (עודכן לפני יומיים בטעות; אמור להיות ${newIp})`,
      },
      {
        key: "servers",
        label: "רשימת שרתים",
        body: `${oldIp}: שרת ישן, הוצא משימוש לפני חודש, עדיין רץ עם תעודה ישנה שפגה\nשרת נוכחי (production): פעיל, תעודה תקינה`,
      },
      {
        key: "cert",
        label: "פרטי תעודה בשרת הישן",
        body: "תוקף: פג לפני 3 ימים (השרת הישן לא מתוחזק יותר)",
      },
      {
        key: "browsererr",
        label: "טקסט שגיאת הדפדפן",
        decoy: true,
        body: "NET::ERR_CERT_DATE_INVALID",
      },
    ],
    decisiveArtifactKeyQ1: "dns",
    decisiveArtifactKeyQ3: "dns",
    q1Options: [
      {
        text: "התעודה בשרת הנוכחי (production) פגה לפני יומיים בעקבות תקלה בחידוש האוטומטי, וזו הסיבה לשגיאת האבטחה שהמשתמשים רואים",
      },
      {
        text: `רשומת ה-DNS של תת-הדומיין מצביעה בטעות לשרת הישן (${oldIp}) שהוצא משימוש, במקום לשרת הנוכחי (${newIp})`,
        correct: true,
      },
      {
        text: "כלל redirect שהוגדר השבוע שגוי ומפנה את כל הבקשות בלולאה חוזרת, וזו הסיבה שהדפדפן מציג שגיאת אבטחה למשתמשים",
      },
      {
        text: "שרת ה-DNS הפנימי נפל היום בפתאומיות ומחזיר תשובות לא עקביות, כך שחלק מהבקשות מגיעות לכתובת שגויה לגמרי",
      },
    ],
    q3Prompt: "לאיזו כתובת IP אמורה רשומת ה-DNS להצביע?",
    q3Fact: newIp,
    correctActionText: `לתקן את רשומת ה-DNS כך שתצביע ל-${newIp} (השרת הנוכחי עם התעודה התקינה)`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את השרת הישן מיד בלי לוודא קודם שאף שירות אחר לא עדיין תלוי בכתובת שלו",
      treat_symptom: "לבקש מהמשתמשים להתעלם מאזהרת האבטחה בדפדפן וללחוץ 'המשך' עד שמישהו יטפל בזה",
      fix_decoy: "לנתח לעומק את טקסט שגיאת הדפדפן ואת קוד השגיאה המדויק, למרות שרשומת ה-DNS כבר מראה את הבעיה",
      busywork_gather_more: "לבדוק את כל רשומות ה-DNS של כל תת-הדומיינים בחברה לפני שמתקנים את זו שכבר ידוע שמצביעה לכתובת שגויה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  void rng;
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "proxy",
        label: "כללי proxy — עודכנו הבוקר",
        body: "כלל חדש: portal.example.co.il -> redirect -> portal.example.co.il (הפניה לאותה כתובת בדיוק, נוספה בטעות בפריסה הבוקר)",
      },
      {
        key: "cert",
        label: "פרטי תעודה",
        body: "תוקף: בתוקף למשך 60 יום נוספים",
      },
      {
        key: "dns",
        label: "רשומות DNS",
        body: "portal.example.co.il  A  203.0.113.10 (תקין)",
      },
      {
        key: "browsererr",
        label: "טקסט שגיאת הדפדפן",
        body: "ERR_TOO_MANY_REDIRECTS",
      },
      {
        key: "chat",
        label: "צ'אט צוות",
        decoy: true,
        body: "מאיה: יש עדכון גרסה לספריית ה-CSS, לא קשור כנראה.",
      },
    ],
    decisiveArtifactKeyQ1: "proxy",
    decisiveArtifactKeyQ3: "browsererr",
    q1Options: [
      {
        text: "תעודת ה-TLS של תת-הדומיין פגה הבוקר ולא חודשה בזמן על ידי צוות התשתיות שאחראי לכך, וזו הסיבה שהדפדפן מציג שגיאת אבטחה למשתמשים",
      },
      {
        text: "רשומת ה-DNS של תת-הדומיין השתנתה בטעות הבוקר בזמן הפריסה האחרונה ומצביעה כעת לשרת שגוי שאינו מריץ את השירות הנכון כלל",
      },
      {
        text: "כלל proxy חדש שנוסף הבוקר יוצר לולאת הפניה (redirect) של הדומיין לעצמו, כך שהדפדפן עוצר את הטעינה אחרי יותר מדי הפניות",
        correct: true,
      },
      {
        text: "שרת ה-DNS הפנימי נפל הבוקר בדיוק בזמן הפריסה החדשה שבוצעה, כך שהבקשות לא מגיעות לשרת בכלל וחוזרות עם שגיאה ברורה",
      },
    ],
    q3Prompt: "מה הטקסט המדויק של שגיאת הדפדפן?",
    q3Fact: "ERR_TOO_MANY_REDIRECTS",
    correctActionText: "להסיר את כלל ה-redirect השגוי שנוסף הבוקר ולוודא שהאתר נטען בלי לולאה",
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את כל הגדרות ה-proxy ולהתחיל להגדיר אותן מאפס, כולל כללים שעבדו תקין עד היום",
      treat_symptom: "לבקש מהמשתמשים לנקות עוגיות (cookies) ומטמון בדפדפן, למרות שהשגיאה חוזרת גם בדפדפן נקי",
      fix_decoy: "לחדש את תעודת ה-TLS למרות שהיא עדיין בתוקף למשך 60 יום נוספים לפי בדיקת הפרטים",
      busywork_gather_more: "לעבור על כל כללי ה-proxy שהוגדרו השנה בכל הדומיינים לפני שמסירים את הכלל שנוסף הבוקר",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.cert_expired_subdomain",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
