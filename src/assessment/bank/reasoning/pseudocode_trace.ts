// reasoning.pseudocode_trace — ASSESSMENT_DESIGN.md §3.2. 6-line
// language-neutral loop; what is printed? Kind: numeric.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";

export const template: ItemTemplate = {
  id: "reasoning.pseudocode_trace",
  version: 1,
  pillar: "reasoning",
  kind: "numeric",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const start = rng.nextIntBetween(1, 5);
    const limit = rng.nextIntBetween(4, 7);
    const step = rng.nextIntBetween(2, 4);

    if (difficulty === 1) {
      // total = 0; for i in [start..limit]: total = total + i; print(total)
      let total = 0;
      for (let i = start; i <= limit; i++) total += i;
      const prompt =
        "עקבו אחר הפסאודו-קוד הבא וקבעו מה יודפס:\n\n" +
        "```\n" +
        `total = 0\n` +
        `for i from ${start} to ${limit}:\n` +
        `    total = total + i\n` +
        `print(total)\n` +
        "```";
      return { content: { prompt }, answerKey: { kind: "numeric", correctValue: total } };
    }

    if (difficulty === 2) {
      // total = 0; for i in [start..limit]: if i % step == 0: total = total + i; print(total)
      let total = 0;
      for (let i = start; i <= limit + 3; i++) if (i % step === 0) total += i;
      const prompt =
        "עקבו אחר הפסאודו-קוד הבא וקבעו מה יודפס:\n\n" +
        "```\n" +
        `total = 0\n` +
        `for i from ${start} to ${limit + 3}:\n` +
        `    if i mod ${step} == 0:\n` +
        `        total = total + i\n` +
        `print(total)\n` +
        "```";
      return { content: { prompt }, answerKey: { kind: "numeric", correctValue: total } };
    }

    // difficulty 3: nested loop with a running multiplier and a skip
    let total = 0;
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= step; j++) {
        if (j === 2) continue;
        total += i * j;
      }
    }
    const prompt =
      "עקבו אחר הפסאודו-קוד הבא וקבעו מה יודפס:\n\n" +
      "```\n" +
      `total = 0\n` +
      `for i from 1 to 3:\n` +
      `    for j from 1 to ${step}:\n` +
      `        if j == 2: continue\n` +
      `        total = total + (i * j)\n` +
      `print(total)\n` +
      "```";
    return { content: { prompt }, answerKey: { kind: "numeric", correctValue: total } };
  },
};
