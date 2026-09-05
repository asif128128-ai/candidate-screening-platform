// tech.security_smell — ASSESSMENT_DESIGN.md §3.4. N practices, one
// dangerous.
//
// d1 uses blatant, textbook-dangerous practices (key in frontend, shared
// admin account, open bucket, no MFA on root) against clearly-safe options
// — the "smell" is obvious on a single read. d2 uses subtler dangerous
// practices (long-lived keys, an internet-exposed DB behind only a
// password, a shared JWT-signing secret, debug logs with secrets) and
// pairs each with a safe-looking-but-actually-fine option that shares a
// surface feature with the real d1 danger (e.g. "public bucket" that holds
// only non-sensitive static assets, or a single "shared" service account
// that's a narrowly-scoped CI identity) — so a shortcut like "public =
// bad" or "shared account = bad" is no longer sufficient.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

interface Practice {
  text: string;
  dangerous: boolean;
}

const POOL_EASY: Practice[] = [
  { text: "מפתח API סודי מוטמע ישירות בקוד ה-frontend שרץ בדפדפן", dangerous: true },
  { text: "חשבון מנהל אחד (\"admin\") שכל הצוות משתמש בו במקום חשבונות אישיים", dangerous: true },
  { text: "דלי אחסון (storage bucket) עם קבצי לקוחות שמוגדר כציבורי (public)", dangerous: true },
  { text: "חשבון ה-root של ספק הענן ללא אימות דו-שלבי (MFA)", dangerous: true },
  { text: "כל מפתח בצוות משתמש בחשבון אישי משלו עם הרשאות מותאמות לתפקיד", dangerous: false },
  { text: "סודות (secrets) נשמרים במנהל סודות ייעודי (secrets manager) ולא בקוד", dangerous: false },
  { text: "דלי אחסון עם קבצי לקוחות שמוגדר כפרטי, וגישה רק דרך קישורים חתומים וזמניים", dangerous: false },
  { text: "חשבון ה-root מוגן ב-MFA ומשמש רק למקרי חירום, כשהעבודה השוטפת דרך חשבונות משנה", dangerous: false },
];

// Each dangerous item here is paired with the safe item right after it,
// which deliberately shares a surface word/feature with a d1 "always
// dangerous" pattern (public / shared / open) but is actually fine.
interface Pair {
  dangerous: string;
  safeDecoy: string;
}
const HARD_PAIRS: Pair[] = [
  {
    dangerous: "צוות הפיתוח משתמש במפתחות API ארוכי-טווח (long-lived) שלא פגים לעולם, במקום טוקנים זמניים",
    safeDecoy: "דלי האחסון הציבורי (public) מכיל רק קבצים סטטיים כמו לוגו ואייקונים של האתר — ללא נתוני לקוחות",
  },
  {
    dangerous: "גישה למסד הנתונים הראשי נפתחת ישירות מרשת האינטרנט הפתוחה, מוגנת רק בסיסמה",
    safeDecoy: "חשבון שירות (service account) יחיד משמש רק את ה-CI/CD, עם הרשאות מוגבלות לפריסה בלבד וללא גישה אנושית",
  },
  {
    dangerous: "כל השירותים הפנימיים חולקים אותו secret אחד לחתימת טוקנים (JWT), כדי לפשט את הניהול",
    safeDecoy: "לוגים ברמת debug כוללים מזהה בקשה מלא, אך כל שדה שמכיל סוד מסונן (redacted) לפני הכתיבה",
  },
  {
    dangerous: "משתני סביבה עם סודות מודפסים ל-log ברמת debug, אבל רק בסביבת staging",
    safeDecoy: "חשבון ה-root מוגן ב-MFA ומשמש רק למקרי חירום, כשהעבודה השוטפת דרך חשבונות משנה",
  },
];
const HARD_EXTRA_SAFE = [
  "כל מפתח בצוות משתמש בחשבון אישי משלו עם הרשאות מותאמות לתפקיד",
  "סודות (secrets) נשמרים במנהל סודות ייעודי (secrets manager) ולא בקוד",
  "דלי אחסון עם קבצי לקוחות שמוגדר כפרטי, וגישה רק דרך קישורים חתומים וזמניים",
];

export const template: ItemTemplate = {
  id: "tech.security_smell",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    if (difficulty === 1) {
      const dangerous = rng.pick(POOL_EASY.filter((p) => p.dangerous));
      const safe = rng.sample(
        POOL_EASY.filter((p) => !p.dangerous),
        3,
      );
      const prompt = "מבין ארבע הפרקטיקות הבאות, שלוש בטוחות ואחת מסוכנת. איזו מהן מסוכנת?";
      const tagged = rng.shuffle([
        { text: dangerous.text, correct: true },
        ...safe.map((p) => ({ text: p.text, correct: false })),
      ]);
      const correctIndex = tagged.findIndex((o) => o.correct);
      return { content: { prompt, options: tagged.map((o) => o.text) }, answerKey: { kind: "single_choice", correctIndex } };
    }

    // d2: the dangerous item's paired decoy is always included, plus 2 more
    // safe options — so a "public/shared = automatically bad" shortcut
    // collides with a genuinely-safe option in the same set.
    const pair = rng.pick(HARD_PAIRS);
    const otherSafe = rng.sample(HARD_EXTRA_SAFE, 2);
    const prompt = "מבין ארבע הפרקטיקות הבאות, שלוש בטוחות ואחת מסוכנת. איזו מהן מסוכנת?";
    const tagged = rng.shuffle([
      { text: pair.dangerous, correct: true },
      { text: pair.safeDecoy, correct: false },
      ...otherSafe.map((text) => ({ text, correct: false })),
    ]);
    const correctIndex = tagged.findIndex((o) => o.correct);
    return { content: { prompt, options: tagged.map((o) => o.text) }, answerKey: { kind: "single_choice", correctIndex } };
  },
};
