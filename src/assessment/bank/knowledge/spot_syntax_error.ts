// knowledge.spot_syntax_error — four one-line snippets, exactly one broken.
// ASSESSMENT_DESIGN.md §3.5.
//
// Deliberately language-neutral in shape (an assignment, a call, a condition)
// and broken in ways that are wrong in every mainstream language — an unclosed
// quote or bracket, a missing comma — so this measures whether someone reads
// code carefully, not whether they know one particular syntax.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const NAMES = ["total", "count", "userName", "items", "price", "status"];
const FUNCS = ["send", "save", "update", "fetch", "log"];
const STRINGS = ["open", "done", "error", "ok"];

export const template: ItemTemplate = {
  id: "knowledge.spot_syntax_error",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const n = () => rng.pick(NAMES);
    const f = () => rng.pick(FUNCS);
    const s = () => rng.pick(STRINGS);

    const wellFormed: Array<() => string> = [
      () => `${n()} = ${rng.nextIntBetween(1, 99)};`,
      () => `${f()}("${s()}");`,
      () => `if (${n()} > ${rng.nextIntBetween(1, 50)}) { ${f()}(); }`,
      () => `const ${n()} = ["${s()}", "${s()}"];`,
      () => `${n()} = ${f()}(${n()});`,
    ];

    const broken: Array<() => string> = [
      // Unclosed string quote.
      () => `${f()}("${s()});`,
      // Unclosed parenthesis.
      () => `${f()}("${s()}";`,
      // Missing comma between array items.
      () => `const ${n()} = ["${s()}" "${s()}"];`,
      // Unclosed brace.
      () => `if (${n()} > ${rng.nextIntBetween(1, 50)}) { ${f()}();`,
      // Stray operator.
      () => `${n()} = = ${rng.nextIntBetween(1, 99)};`,
    ];

    const correct = rng.pick(broken)();
    const seen = new Set<string>([correct]);
    const distractors: string[] = [];
    for (let attempt = 0; attempt < 200 && distractors.length < 3; attempt++) {
      const v = rng.pick(wellFormed)();
      if (seen.has(v)) continue;
      seen.add(v);
      distractors.push(v);
    }

    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);

    return {
      content: { prompt: "באיזו מהשורות הבאות יש שגיאת תחביר?", options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
