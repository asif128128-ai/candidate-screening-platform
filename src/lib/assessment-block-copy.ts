// ASSESSMENT_DESIGN.md §2: fixed block order, Hebrew names, per-item time
// limit, and the "how it works" collapsed panel copy for each block intro
// screen. Static because the seed blueprint's block shape is fixed
// (ARCHITECTURE.md §5.1 / DATA_MODEL.md §3.3) — if a future blueprint ever
// changes block composition, this table (like generator.ts's own
// DIFFICULTY_MIX) needs updating alongside it. See IMPLEMENTATION_NOTES.md
// for why the intro screen is keyed off this static table rather than a
// server-provided "preview" (the hot-path API has no such endpoint: serving
// an item and starting its clock are the same call, by design).

export interface BlockCopy {
  key: string;
  nameHe: string;
  itemCount: number;
  timeLimitS: number;
  ruleHe: string;
  howItWorksHe: string;
}

export const BLOCK_ORDER = ["speed", "reasoning", "tech", "investigate"] as const;

export const BLOCK_COPY: Record<string, BlockCopy> = {
  speed: {
    key: "speed",
    nameHe: "חימום מהיר",
    itemCount: 10,
    timeLimitS: 20,
    ruleHe: "10 שאלות קצרות, 20 שניות לכל אחת. קריאה ותשובה מהירה ומדויקת.",
    howItWorksHe:
      "כל שאלה מציגה עובדה קטנה (קטע קוד, טבלה, לוג) ושואלת עליה שאלה אחת ברורה. אין צורך בידע מוקדם — כל מה שנדרש כתוב בשאלה עצמה.",
  },
  reasoning: {
    key: "reasoning",
    nameHe: "חשיבה",
    itemCount: 6,
    timeLimitS: 75,
    ruleHe: "6 שאלות היסק וחשיבה, 75 שניות לכל אחת.",
    howItWorksHe: "חלק מהשאלות הן חזותיות (צורות, דיאגרמות) וחלקן מספריות. אין תשובה \"נכונה מהזיכרון\" — הכול נובע מהנתונים שמוצגים.",
  },
  tech: {
    key: "tech",
    nameHe: "אינסטינקט טכנולוגי",
    itemCount: 7,
    timeLimitS: 60,
    ruleHe: "7 שאלות על מצבים טכניים, 60 שניות לכל אחת.",
    howItWorksHe: "כל שאלה מתארת מצב קצר (לוג, תשובת שרת, טבלת הרשאות) ושואלת מה הפעולה או ההסבר הכי סביר. כל מוסכמה שצריך יודגש בתוך השאלה.",
  },
  investigate: {
    key: "investigate",
    nameHe: "חקירה",
    itemCount: 4,
    timeLimitS: 180,
    ruleHe: "4 תרחישי חקירה, 180 שניות לכל אחד. כמה כרטיסיות מידע לכל תרחיש.",
    howItWorksHe:
      "כל תרחיש מציג כרטיס תמיכה וכמה כרטיסיות מידע (לוגים, הגדרות, שיחות). התפקיד: למצוא את שורש הבעיה, לבחור את הפעולה הנכונה הראשונה, ולחלץ עובדה קונקרטית. לא כל כרטיסייה רלוונטית.",
  },
};

/** Seed blueprint's fixed position ranges per block (ASSESSMENT_DESIGN.md §2 table). */
export function blockKeyForPosition(position: number): string {
  if (position <= 10) return "speed";
  if (position <= 16) return "reasoning";
  if (position <= 23) return "tech";
  return "investigate";
}

export const BLOCK_INTRO_AUTO_ADVANCE_MS = 45_000;
export const PRACTICE_SCENE_AUTO_ADVANCE_MS = 90_000;
