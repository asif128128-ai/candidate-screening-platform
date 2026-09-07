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

export const BLOCK_ORDER = ["speed", "knowledge", "reasoning", "tech", "investigate"] as const;

/**
 * ASSESSMENT_DESIGN.md §2.2 — shown on every block intro, under the rule
 * line. The tight limits are a deliberate design choice, so we say so out
 * loud rather than letting a candidate discover it as a nasty surprise: told
 * plainly that reaching for an AI app costs more time than it saves, an
 * honest candidate stops weighing it and just plays, and the timing stops
 * reading as arbitrary cruelty. Deliberately not a threat — nothing here
 * accuses anyone or mentions monitoring (that disclosure lives separately,
 * ANTI_CHEATING.md §2, and stays separate: one is about intent, the other
 * about what we record).
 */
export const AI_DECLARATION_HE =
  "מהיר בכוונה. עובדים עם הראש, לא עם אפליקציה — זה בדיוק מה שאנחנו רוצים לראות.";

export const BLOCK_COPY: Record<string, BlockCopy> = {
  speed: {
    key: "speed",
    nameHe: "חימום מהיר",
    itemCount: 10,
    timeLimitS: 15,
    ruleHe: "10 שאלות קצרות, 15 שניות לכל אחת. קריאה ותשובה מהירה ומדויקת.",
    howItWorksHe:
      "כל שאלה מציגה עובדה קטנה (קטע קוד, טבלה, לוג) ושואלת עליה שאלה אחת ברורה. אין צורך בידע מוקדם — כל מה שנדרש כתוב בשאלה עצמה.",
  },
  knowledge: {
    key: "knowledge",
    nameHe: "ידע טכנולוגי",
    itemCount: 10,
    timeLimitS: 15,
    ruleHe: "10 שאלות ידע קצרות, 15 שניות לכל אחת. יודעים או לא יודעים — אין מה לחשב.",
    howItWorksHe:
      "שאלות על מושגים, כלים ופורמטים מהעולם הטכנולוגי — מה זה DNS, איזו כתובת IP תקינה, מה מכיל קובץ מסוים. אם אתם מכירים את המושג, התשובה לוקחת שניות ספורות.",
  },
  reasoning: {
    key: "reasoning",
    nameHe: "חשיבה",
    itemCount: 6,
    timeLimitS: 30,
    ruleHe: "6 שאלות היסק וחשיבה, 30 שניות לכל אחת.",
    howItWorksHe:
      "חלק מהשאלות מספריות, חלקן מילוליות, ואחת מציגה סדרת צורות. אין תשובה \"נכונה מהזיכרון\" — הכול נובע מהנתונים שמוצגים.",
  },
  tech: {
    key: "tech",
    nameHe: "אינסטינקט טכנולוגי",
    itemCount: 8,
    timeLimitS: 30,
    ruleHe: "8 שאלות על מצבים טכניים, 30 שניות לכל אחת.",
    howItWorksHe: "כל שאלה מתארת מצב קצר (לוג, תשובת שרת, טבלת הרשאות) ושואלת מה הפעולה או ההסבר הכי סביר. כל מוסכמה שצריך יודגש בתוך השאלה.",
  },
  investigate: {
    key: "investigate",
    nameHe: "חקירה",
    itemCount: 3,
    timeLimitS: 150,
    ruleHe: "3 תרחישי חקירה, 150 שניות לכל אחד. כמה כרטיסיות מידע לכל תרחיש.",
    howItWorksHe:
      "כל תרחיש מציג כרטיס תמיכה וכמה כרטיסיות מידע (לוגים, הגדרות, שיחות). התפקיד: למצוא את שורש הבעיה, לבחור את הפעולה הנכונה הראשונה, ולחלץ עובדה קונקרטית. לא כל כרטיסייה רלוונטית.",
  },
};

/**
 * Seed blueprint's fixed position ranges per block (ASSESSMENT_DESIGN.md §2
 * table). Blueprint v3 (0014_blueprint_v3_knowledge_block.sql):
 * 10 + 10 + 6 + 8 + 3 = 37 items.
 */
export function blockKeyForPosition(position: number): string {
  if (position <= 10) return "speed";
  if (position <= 20) return "knowledge";
  if (position <= 26) return "reasoning";
  if (position <= 34) return "tech";
  return "investigate";
}

export const BLOCK_INTRO_AUTO_ADVANCE_MS = 45_000;
// Red-team finding #6: PRACTICE_SCENE_AUTO_ADVANCE_MS (90s) used to silently
// force-advance the candidate out of the pre-investigation practice scene
// into the real, scored assessment, directly contradicting that scene's own
// copy ("לא מתוזמן, לא נספר" — "not timed, not counted"). Removed rather
// than disclosed (ASSESSMENT_DESIGN.md §2's whole point for this scene is
// removing time pressure for candidates who need longer to get comfortable
// with the multi-tab investigation UI — DECISIONS_LOG.md #1) — see
// src/app/(candidate)/[locale]/apply/[applicationId]/assessment/practice-scene.tsx.
// Safe to remove entirely: the practice scene is a client-only phase before
// any server call, so no server-side clock (item deadline or session wall
// clock) starts until the candidate actually clicks through — lingering
// here has no effect beyond eating into the candidate's own overall session
// time budget, which is their choice to make.
