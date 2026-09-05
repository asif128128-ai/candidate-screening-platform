// speed.regex_match — ASSESSMENT_DESIGN.md §3.1. The item shows a 3-line
// legend for the only operators used, per DECISIONS_LOG.md #8.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const LEGEND =
  "מקרא: `\\d` = ספרה בודדת, `+` = אחד או יותר מהתו הקודם, `{n}` = בדיוק n פעמים, `^`/`$` = תחילת/סוף המחרוזת.";

interface PatternDef {
  pattern: string;
  human: string;
  make: (rng: Rng) => string; // a string that matches
  breakers: Array<(rng: Rng, good: string) => string>; // strings that don't match
}

const PATTERNS: PatternDef[] = [
  {
    pattern: "^\\d{3}-\\d{2}$",
    human: "^\\d{3}-\\d{2}$",
    make: (r) => `${r.nextIntBetween(100, 999)}-${r.nextIntBetween(10, 99)}`,
    breakers: [
      (r) => `${r.nextIntBetween(10, 99)}-${r.nextIntBetween(10, 99)}`, // too few digits before dash
      (r) => `${r.nextIntBetween(100, 999)}-${r.nextIntBetween(100, 999)}`, // too many after dash
      (r) => `${r.nextIntBetween(100, 999)}_${r.nextIntBetween(10, 99)}`, // wrong separator
    ],
  },
  {
    pattern: "^\\d+$",
    human: "^\\d+$",
    make: (r) => String(r.nextIntBetween(1, 999999)),
    breakers: [
      (r) => `${r.nextIntBetween(1, 999)}a`,
      (r) => `-${r.nextIntBetween(1, 999)}`,
      () => "",
    ],
  },
  {
    pattern: "^\\d{2}:\\d{2}$",
    human: "^\\d{2}:\\d{2}$",
    make: (r) => `${String(r.nextIntBetween(0, 23)).padStart(2, "0")}:${String(r.nextIntBetween(0, 59)).padStart(2, "0")}`,
    breakers: [
      (r) => `${r.nextIntBetween(0, 9)}:${String(r.nextIntBetween(0, 59)).padStart(2, "0")}`, // one digit hour
      (r) => `${String(r.nextIntBetween(0, 23)).padStart(2, "0")}:${r.nextIntBetween(0, 9)}`, // one digit minute
      (r) => `${String(r.nextIntBetween(0, 23)).padStart(2, "0")}-${String(r.nextIntBetween(0, 59)).padStart(2, "0")}`, // wrong separator
    ],
  },
  {
    pattern: "^\\d{4}\\d+$",
    human: "^\\d{4}\\d+$",
    make: (r) => `${String(r.nextIntBetween(1000, 9999))}${r.nextIntBetween(1, 999)}`,
    breakers: [
      // Same length as the matching string (one digit swapped for a letter),
      // so a "pick the longest option" strategy can't use length as a
      // shortcut — the candidate has to actually check the character.
      (r, good) => `${good.slice(0, -1)}${"abcdefghjkmnpqr"[r.nextIntBetween(0, 14)]}`,
      (r) => `${r.nextIntBetween(100, 999)}x${r.nextIntBetween(1, 99)}`,
      () => "",
    ],
  },
];

export const template: ItemTemplate = {
  id: "speed.regex_match",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: LEGEND,
  fluency: true,
  generate(rng: Rng) {
    const def = rng.pick(PATTERNS);
    const good = def.make(rng);
    const chosenBreakers = rng.sample(def.breakers, 3);
    const bad = chosenBreakers.map((b) => b(rng, good));

    const prompt =
      `${LEGEND}\n\n` +
      `הביטוי הרגולרי: \`${def.human}\`\n` +
      "איזו מהמחרוזות הבאות תואמת את הביטוי במלואו?";
    const { options, correctIndex } = shuffleOptions(rng, good, bad);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
