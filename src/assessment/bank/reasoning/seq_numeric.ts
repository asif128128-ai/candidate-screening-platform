// reasoning.seq_numeric — ASSESSMENT_DESIGN.md §3.2. Sequence with a
// two-rule composition (alternating step, or second-order/Fibonacci-like).
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

type Kind = "alternating" | "second_order" | "arithmetic";

function buildSequence(rng: Rng, kind: Kind, len: number): number[] {
  const seq: number[] = [];
  if (kind === "arithmetic") {
    const start = rng.nextIntBetween(1, 10);
    const step = rng.nextIntBetween(2, 6);
    for (let i = 0; i < len; i++) seq.push(start + step * i);
  } else if (kind === "alternating") {
    const stepA = rng.nextIntBetween(2, 6);
    const stepB = rng.nextIntBetween(2, 6) * -1;
    let cur = rng.nextIntBetween(10, 30);
    for (let i = 0; i < len; i++) {
      seq.push(cur);
      cur += i % 2 === 0 ? stepA : stepB;
    }
  } else {
    // second_order: each term is the sum of the two before it, scaled
    seq.push(rng.nextIntBetween(1, 5), rng.nextIntBetween(1, 5));
    for (let i = 2; i < len; i++) {
      seq.push((seq[i - 1] as number) + (seq[i - 2] as number));
    }
  }
  return seq;
}

export const template: ItemTemplate = {
  id: "reasoning.seq_numeric",
  version: 1,
  pillar: "reasoning",
  kind: "numeric",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const kind: Kind = difficulty === 1 ? "arithmetic" : difficulty === 2 ? "alternating" : "second_order";
    const shownLen = difficulty === 3 ? 6 : 5;
    const seq = buildSequence(rng, kind, shownLen + 1);
    const shown = seq.slice(0, shownLen);
    const answer = seq[shownLen] as number;

    const prompt = `לפניכם רצף מספרים:\n\n${shown.join(", ")}, ?\n\nמה המספר הבא ברצף?`;
    return {
      content: { prompt },
      answerKey: { kind: "numeric", correctValue: answer },
    };
  },
};
