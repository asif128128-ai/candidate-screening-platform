// speed.bracket_balance — ASSESSMENT_DESIGN.md §3.1 ("replaces a
// binary-conversion item that rewarded a specific course", DECISIONS_LOG.md
// #8). conventions_stated: n/a — matching brackets needs no prior exposure.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

const PAIRS: Array<[string, string]> = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
];

function buildBalanced(rng: Rng, pairCount: number): string {
  // Build by randomly nesting/sequencing pairs (a valid Dyck-like word over 3 bracket types).
  const stack: string[] = [];
  let out = "";
  let opened = 0;
  let closed = 0;
  while (closed < pairCount) {
    const mustClose = stack.length > 0 && (opened >= pairCount || rng.chance(0.45));
    if (mustClose) {
      const top = stack.pop() as string;
      out += top;
      closed++;
    } else {
      const [open, close] = rng.pick(PAIRS);
      out += open;
      stack.push(close);
      opened++;
    }
  }
  while (stack.length > 0) out += stack.pop();
  return out;
}

function analyze(s: string): { balanced: boolean; breakPos: number | null } {
  const opens = new Set(["(", "[", "{"]);
  const closeToOpen: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    if (opens.has(ch)) {
      stack.push(ch);
    } else {
      const expected = closeToOpen[ch];
      const top = stack.pop();
      if (top !== expected) return { balanced: false, breakPos: i + 1 };
    }
  }
  if (stack.length > 0) return { balanced: false, breakPos: s.length };
  return { balanced: true, breakPos: null };
}

/** Corrupts a balanced string at one closing-bracket position, guaranteeing a well-defined first break position. */
function corrupt(rng: Rng, s: string): { text: string; breakPos: number } {
  const closers = ")]}".split("");
  const closingIdxs: number[] = [];
  for (let i = 0; i < s.length; i++) if (closers.includes(s[i] as string)) closingIdxs.push(i);
  const idx = rng.pick(closingIdxs);
  const original = s[idx] as string;
  const alternatives = closers.filter((c) => c !== original);
  const replacement = rng.pick(alternatives);
  const text = s.slice(0, idx) + replacement + s.slice(idx + 1);
  const result = analyze(text);
  // By construction this is always false with breakPos === idx+1, but assert defensively.
  if (result.balanced || result.breakPos === null) {
    throw new Error("bracket_balance: corruption did not produce a break");
  }
  return { text, breakPos: result.breakPos };
}

export const template: ItemTemplate = {
  id: "speed.bracket_balance",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const pairCount = rng.nextIntBetween(4, 6);
    const base = buildBalanced(rng, pairCount);
    const isBalanced = rng.chance(0.4);
    const length = base.length;

    const posLabel = (p: number) => `לא מאוזן — נשבר במיקום ${p}`;
    const BALANCED_LABEL = "מאוזן";

    if (isBalanced) {
      const wrongPositions = generateDistinctDistractors(
        3,
        [],
        () => rng.nextIntBetween(1, length),
        (v) => String(v),
      );
      const prompt = `האם רצף הסוגריים הבא מאוזן? אם לא, באיזה מיקום (מספר התו, מ-1) הוא נשבר?\n\n\`${base}\``;
      const { options, correctIndex } = shuffleOptions(rng, BALANCED_LABEL, wrongPositions.map(posLabel));
      return {
        content: { prompt, options },
        answerKey: { kind: "single_choice", correctIndex },
      };
    }

    const { text, breakPos } = corrupt(rng, base);
    const wrongPositions = generateDistinctDistractors(
      2,
      [String(breakPos)],
      () => rng.nextIntBetween(1, text.length),
      (v) => String(v),
    );
    const distractorLabels = [BALANCED_LABEL, ...wrongPositions.map((p) => posLabel(Number(p)))];
    const prompt = `האם רצף הסוגריים הבא מאוזן? אם לא, באיזה מיקום (מספר התו, מ-1) הוא נשבר?\n\n\`${text}\``;
    const { options, correctIndex } = shuffleOptions(rng, posLabel(breakPos), distractorLabels);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
