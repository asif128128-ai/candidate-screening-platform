// investigate.export_permission — ASSESSMENT_DESIGN.md §3.3. A user can't
// export a report others can.
import type { Cause, InvestigationScenario } from "../../types";
import type { Rng } from "../../rng";
import { NAME_POOL } from "../helpers";
import { buildInvestigationItem, genericAntiPatterns, type VariantWorld } from "./helpers";

const TICKET = 'כרטיס תמיכה — "אני לא מצליח/ה לייצא דוח, אבל עמיתים בתפקיד דומה כן מצליחים."';

function buildA(rng: Rng): VariantWorld {
  const user = rng.pick(NAME_POOL);
  const peer = rng.pick(NAME_POOL.filter((n) => n !== user));
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "roles",
        label: "מטריצת הרשאות",
        body: `Analyst: view=✔ export=✔\nViewer: view=✔ export=✘`,
      },
      {
        key: "users",
        label: "רשומת משתמשים",
        body: `${user}: role=Viewer\n${peer}: role=Analyst`,
      },
      {
        key: "auditlog",
        label: "יומן שינויי הרשאות",
        body: `לפני חודשיים: ${user} שויך לתפקיד Viewer בטעות בזמן מיגרציה (אמור היה להיות Analyst כמו שאר הצוות)`,
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: `${peer}: הדפדפן שלי קצת איטי היום, מישהו עוד מרגיש ככה?`,
      },
    ],
    decisiveArtifactKeyQ1: "roles",
    decisiveArtifactKeyQ3: "auditlog",
    q1Options: [
      {
        text: "יש דגל פיצ'ר (feature flag) שחוסם ייצוא לארגון הזה כולו, וזו הסיבה שהמשתמש הספציפי לא מצליח לייצא",
      },
      {
        text: `ל-${user} יש תפקיד Viewer שאינו כולל הרשאת export, בעוד ${peer} משויך ל-Analyst שכן כוללת`,
        correct: true,
      },
      {
        text: "הדפדפן של המשתמש איטי מדי ומתנתק לפני שהייצוא מסתיים, בעוד עמיתיו משתמשים בדפדפן מעודכן יותר",
      },
      {
        text: `${user} משויך לקבוצה הלא נכונה במערכת בעקבות מיגרציה קודמת, וזו הקבוצה שחוסמת ממנו את פעולת הייצוא`,
      },
    ],
    q3Prompt: "כמה זמן עבר מאז שהמשתמש שויך לתפקיד השגוי?",
    q3Fact: "חודשיים",
    correctActionText: `לשנות את התפקיד של ${user} ל-Analyst (כפי שהיה אמור מלכתחילה) ולוודא שהייצוא עובד`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "לתת למשתמש הרשאת מנהל מלאה כדי לפתור את זה מהר, במקום להעניק בדיוק את התפקיד המתאים לו",
      treat_symptom: "לייצא את הדוח עבור המשתמש ידנית כל פעם מחדש, בלי לתקן את תפקיד ההרשאה השגוי שגורם לחסימה",
      fix_decoy: "לחקור לעומק את איטיות הדפדפן שדווחה בצ'אט, למרות שמטריצת ההרשאות מראה בבירור תפקיד חסר export",
      busywork_gather_more: "לעבור על כל יומן ההרשאות של השנה האחרונה לכל המשתמשים לפני שמתקנים את התפקיד שכבר אותר כשגוי",
    }),
  };
}

function buildB(rng: Rng): VariantWorld {
  const org = rng.pick(["ארגון-צפון", "ארגון-דרום"]);
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "flags",
        label: "דגלי פיצ'רים (feature flags)",
        body: `export_v2: enabled_for = [ארגון-מרכז]\n(${org} אינו ברשימה)`,
      },
      {
        key: "users",
        label: "רשומת משתמשים",
        body: `המשתמש שייך לארגון: ${org}, role=Analyst`,
      },
      {
        key: "errlog",
        label: "לוג שגיאות אפליקציה",
        body: `export_attempt org=${org} -> feature_disabled`,
      },
      {
        key: "billing",
        label: "חשבונית",
        decoy: true,
        body: "החיוב החודשי תקין, ללא חריגות.",
      },
    ],
    decisiveArtifactKeyQ1: "flags",
    decisiveArtifactKeyQ3: "flags",
    q1Options: [
      {
        text: `למשתמש ב-${org} חסרה הרשאת role מתאימה כרגע במטריצת ההרשאות המלאה, בעוד שאר הצוות שויך לתפקיד עם export`,
      },
      {
        text: `דגל הפיצ'ר export_v2 מופעל רק עבור ארגון-מרכז; ${org} לא נכלל ברשימה, ולכן כל ניסיון ייצוא נכשל בו`,
        correct: true,
      },
      {
        text: "יש בעיית חיוב לא פתורה בחשבון הארגון שגורמת למערכת לחסום פעולות מתקדמות כמו ייצוא עד להסדרת התשלום",
      },
      {
        text: "המשתמש שייך לקבוצה הלא נכונה במערכת בעקבות מיגרציה ישנה קודמת שלא עודכנה כראוי, וזו הקבוצה שחוסמת את הייצוא",
      },
    ],
    q3Prompt: "מה שם דגל הפיצ'ר שחוסם את הייצוא?",
    q3Fact: "export_v2",
    correctActionText: `להוסיף את ${org} לרשימת הארגונים המורשים בדגל export_v2, ולוודא שהייצוא עובד`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "להפעיל את הדגל עבור כל הארגונים בבת אחת בלי לבדוק אם חלקם עדיין לא אמורים לקבל את הפיצ'ר",
      treat_symptom: "לייצא את הדוח ידנית עבור אותו ארגון בכל פעם שמישהו מבקש, בלי להוסיף אותו לרשימת הדגל",
      fix_decoy: "לבדוק לעומק את החיוב החודשי של הארגון, למרות שהחשבונית מוצגת כתקינה ללא חריגות",
      busywork_gather_more: "לעבור על כל דגלי הפיצ'רים הקיימים במערכת לפני שמוסיפים את הארגון לרשימה שכבר אותרה כחסרה",
    }),
  };
}

function buildC(rng: Rng): VariantWorld {
  const user = rng.pick(NAME_POOL);
  const wrongGroup = "sales-readonly";
  const rightGroup = "sales-managers";
  return {
    ticket: TICKET,
    tabs: [
      {
        key: "groups",
        label: "קבוצות והרשאות",
        body: `${wrongGroup}: export=✘\n${rightGroup}: export=✔`,
      },
      {
        key: "users",
        label: "רשומת משתמשים",
        body: `${user}: קבוצה = ${wrongGroup} (הועבר לתפקיד ניהולי לפני שבועיים, קבוצת ה-IT לא עודכנה)`,
      },
      {
        key: "auditlog",
        label: "יומן HR/IT",
        body: `לפני שבועיים: ${user} קודם/ה לתפקיד מנהל/ת מכירות. בקשת עדכון קבוצה במערכת נפתחה ולא טופלה.`,
      },
      {
        key: "chat",
        label: "צ'אט תמיכה",
        decoy: true,
        body: "עידו: יש לנו התראה על שימוש גבוה ב-CPU בשרת הדוחות, לא דחוף.",
      },
    ],
    decisiveArtifactKeyQ1: "auditlog",
    decisiveArtifactKeyQ3: "groups",
    q1Options: [
      {
        text: "יש דגל פיצ'ר חדש שחוסם את הייצוא לארגון כולו באופן גורף וללא יוצא מן הכלל, וזו הסיבה שדווקא משתמש אחד ספציפי לא מצליח לייצא",
      },
      {
        text: "מטריצת ההרשאות עצמה שגויה ומעניקה export לקבוצה שלא אמורה כלל לקבל אותו, בעוד הקבוצה הנכונה כן מוגדרת תקין ונכון",
      },
      {
        text: `${user} קודם/ה לתפקיד ניהולי אבל נשאר/ה בקבוצת ${wrongGroup} במערכת במקום ${rightGroup}, כי בקשת העדכון לא טופלה`,
        correct: true,
      },
      {
        text: "עומס CPU גבוה שנמדד לאחרונה בשרת הדוחות חוסם ייצוא עבור כלל המשתמשים ולא רק עבור המשתמש שדיווח על הבעיה כרגע",
      },
    ],
    q3Prompt: "מהי הקבוצה שמעניקה הרשאת export ואליה צריך להעביר את המשתמש?",
    q3Fact: rightGroup,
    correctActionText: `להעביר את ${user} לקבוצת ${rightGroup} כפי שהתבקש לפני שבועיים, ולוודא שהייצוא עובד`,
    isEscalationRequired: false,
    antiPatterns: genericAntiPatterns({
      irreversible_action: "למחוק את חשבון המשתמש הקיים וליצור חשבון חדש מאפס, במקום פשוט להעביר אותו לקבוצה הנכונה",
      treat_symptom: "לייצא את הדוח במקומו כל פעם שהוא צריך אותו, בלי להעביר אותו לקבוצה שמעניקה הרשאת export",
      fix_decoy: "לחקור לעומק את עומס ה-CPU בשרת הדוחות, למרות שיומן ה-HR/IT מצביע במפורש על בקשת עדכון שלא טופלה",
      busywork_gather_more: "לעבור על כל בקשות עדכון הקבוצות הפתוחות במערכת לפני שמטפלים בזו שכבר אותרה כרלוונטית",
    }),
  };
}

export const scenario: InvestigationScenario = {
  id: "investigate.export_permission",
  version: 1,
  causeVariants: ["a", "b", "c"],
  escalationCauses: [],
  generate(rng: Rng, cause: Cause) {
    const world = cause === "a" ? buildA(rng) : cause === "b" ? buildB(rng) : buildC(rng);
    return buildInvestigationItem(rng, world);
  },
};
