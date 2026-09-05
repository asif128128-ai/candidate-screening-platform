// reasoning.rule_induction — ASSESSMENT_DESIGN.md §3.2 worked example 3.
// Black-box function: 4 input->output pairs, predict the 5th. Rules
// composed from a small library of primitives; difficulty 3 composes two.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

type Vec = number[];
interface Primitive {
  name: string;
  apply: (v: Vec, k: number) => Vec;
  needsK: boolean;
  kRange?: [number, number];
}

const PRIMITIVES: Primitive[] = [
  { name: "map(x -> x - k)", apply: (v, k) => v.map((x) => x - k), needsK: true, kRange: [1, 3] },
  { name: "map(x -> x + k)", apply: (v, k) => v.map((x) => x + k), needsK: true, kRange: [1, 3] },
  { name: "map(x -> x * k)", apply: (v, k) => v.map((x) => x * k), needsK: true, kRange: [2, 3] },
  { name: "reverse", apply: (v) => v.slice().reverse(), needsK: false },
  { name: "rotate_left1", apply: (v) => [...v.slice(1), v[0] as number], needsK: false },
];

function randomVec(rng: Rng, len: number): Vec {
  return Array.from({ length: len }, () => rng.nextIntBetween(1, 12));
}

function fmtVec(v: Vec): string {
  return `[${v.join(", ")}]`;
}

export const template: ItemTemplate = {
  id: "reasoning.rule_induction",
  version: 1,
  pillar: "reasoning",
  kind: "short_text",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const len = rng.nextIntBetween(2, 4);
    const composeCount = difficulty === 3 ? 2 : 1;
    const chosen: Array<{ prim: Primitive; k: number }> = [];
    for (let i = 0; i < composeCount; i++) {
      const prim = rng.pick(PRIMITIVES);
      const k = prim.needsK ? rng.nextIntBetween(...(prim.kRange as [number, number])) : 0;
      chosen.push({ prim, k });
    }
    const apply = (v: Vec): Vec => chosen.reduce((acc, { prim, k }) => prim.apply(acc, k), v);

    const pairs: Array<{ input: Vec; output: Vec }> = [];
    for (let i = 0; i < 4; i++) {
      const input = randomVec(rng, len);
      pairs.push({ input, output: apply(input) });
    }
    const testInput = randomVec(rng, len);
    const testOutput = apply(testInput);

    const rows = pairs.map((p) => `| \`${fmtVec(p.input)}\` | \`${fmtVec(p.output)}\` |`).join("\n");
    const prompt =
      "לפניכם פונקציה \"קופסה שחורה\". אלה ארבע דוגמאות של קלט ופלט:\n\n" +
      "| קלט | פלט |\n|---|---|\n" +
      rows +
      `\n\nמה הפלט עבור הקלט \`${fmtVec(testInput)}\`? (מספרים מופרדים בפסיק, למשל: 1, 2, 3)`;

    return {
      content: { prompt },
      answerKey: {
        kind: "short_text",
        correctText: testOutput.join(", "),
        acceptedAlternates: [testOutput.join(","), testOutput.join(" ")],
      },
    };
  },
};
