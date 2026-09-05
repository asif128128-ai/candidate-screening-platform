// Shared rendering/generation helpers used across template families.
// Kept deliberately small and dependency-free (pure, no I/O) — see
// ARCHITECTURE.md §4 "all assessment logic is pure TypeScript with no I/O".

import type { Rng } from "../rng";

/**
 * Build a shuffled option list from one correct answer and N distractors.
 * Returns the final option order plus the index of the correct one, which
 * is exactly what `answerKey.correctIndex` needs (ASSESSMENT_DESIGN.md
 * §2.4: "option order is shuffled per session").
 */
export function shuffleOptions(
  rng: Rng,
  correct: string,
  distractors: readonly string[],
): { options: string[]; correctIndex: number } {
  const tagged = [
    { text: correct, correct: true },
    ...distractors.map((text) => ({ text, correct: false })),
  ];
  const shuffled = rng.shuffle(tagged);
  const correctIndex = shuffled.findIndex((o) => o.correct);
  return { options: shuffled.map((o) => o.text), correctIndex };
}

/** Same idea for a set of correct + incorrect options (multi_choice). */
export function shuffleMultiOptions(
  rng: Rng,
  correctOnes: readonly string[],
  distractors: readonly string[],
): { options: string[]; correctIndexes: number[] } {
  const tagged = [
    ...correctOnes.map((text) => ({ text, correct: true })),
    ...distractors.map((text) => ({ text, correct: false })),
  ];
  const shuffled = rng.shuffle(tagged);
  const correctIndexes = shuffled
    .map((o, i) => (o.correct ? i : -1))
    .filter((i) => i >= 0);
  return { options: shuffled.map((o) => o.text), correctIndexes };
}

/** Normalize text the way SCORING.md §2 requires for short_text/numeric comparison. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["'`״׳([{]+|["'`״׳)\]}]+$/g, "")
    .toLowerCase();
}

/** Two-digit zero pad. */
export function pad2(n: number): number | string {
  return n < 10 ? `0${n}` : n;
}

/** Small Hebrew month names for date rendering. */
export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

/** A small, reusable pool of first names for parameterized artifacts (chat threads, audit logs). */
export const NAME_POOL = [
  "דנה",
  "יוסי",
  "מאיה",
  "אורי",
  "נועה",
  "אלון",
  "שירה",
  "עידו",
  "טל",
  "רועי",
  "ליאור",
  "הילה",
] as const;

/** A small pool of company/service names for logs and tickets, kept generic and Hebrew-neutral (LTR tokens). */
export const SERVICE_POOL = [
  "billing",
  "auth",
  "sync",
  "webhooks",
  "reports",
  "export",
  "search",
  "notifications",
] as const;

/** Draws n distinct items and returns them plus the untouched remainder (useful for correct+distractor splits). */
export function drawDistinct<T>(rng: Rng, pool: readonly T[], n: number): T[] {
  return rng.sample(pool, n);
}

/** Formats a JS number the way Hebrew UI would for small integers/percentages (no locale surprises in tests). */
export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Generates `count` values via `gen()`, keeping only ones whose `keyOf` key
 * has not been seen before (seeded with `excludeKeys`, typically the
 * correct answer's key). Used to structurally guarantee the bank audit's
 * "no two options are textually identical" invariant (ASSESSMENT_DESIGN.md
 * §4.4) instead of hoping collisions don't happen.
 */
export function generateDistinctDistractors<T>(
  count: number,
  excludeKeys: Iterable<string>,
  gen: () => T,
  keyOf: (v: T) => string,
  maxTries = 4000,
): T[] {
  const seen = new Set(excludeKeys);
  const out: T[] = [];
  let tries = 0;
  while (out.length < count && tries < maxTries) {
    const v = gen();
    const k = keyOf(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
    tries++;
  }
  if (out.length < count) {
    throw new Error("generateDistinctDistractors: exhausted maxTries without enough distinct values");
  }
  return out;
}
