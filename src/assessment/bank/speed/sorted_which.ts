// speed.sorted_which — ASSESSMENT_DESIGN.md §3.1. Which of 4 lists is
// sorted ascending? conventions_stated: n/a.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

function randomList(rng: Rng, n: number): number[] {
  const list: number[] = [];
  let cur = rng.nextIntBetween(1, 20);
  for (let i = 0; i < n; i++) {
    list.push(cur);
    cur += rng.nextIntBetween(-9, 12); // usually not monotonic
  }
  return list;
}

function ascendingList(rng: Rng, n: number): number[] {
  const list: number[] = [];
  let cur = rng.nextIntBetween(1, 15);
  for (let i = 0; i < n; i++) {
    list.push(cur);
    cur += rng.nextIntBetween(1, 8);
  }
  return list;
}

function isStrictlyAscending(list: number[]): boolean {
  for (let i = 1; i < list.length; i++) {
    if ((list[i] as number) <= (list[i - 1] as number)) return false;
  }
  return true;
}

export const template: ItemTemplate = {
  id: "speed.sorted_which",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const n = 5;
    const good = ascendingList(rng, n);
    const fmt = (l: number[]) => `[${l.join(", ")}]`;

    let attempt = 0;
    const bad = generateDistinctDistractors(
      3,
      [fmt(good)],
      () => {
        attempt++;
        // Guarantee non-ascending by construction once random draws run out
        // of luck: swap two adjacent elements of a random list.
        let candidate = randomList(rng, n);
        if (attempt > 50 || isStrictlyAscending(candidate)) {
          candidate = good.slice();
          const i = attempt % (n - 1);
          const tmp = candidate[i] as number;
          candidate[i] = candidate[i + 1] as number;
          candidate[i + 1] = tmp;
        }
        return candidate;
      },
      fmt,
    );

    const prompt = "איזו מהרשימות הבאות ממוינת בסדר עולה (מהקטן לגדול)?";
    const { options, correctIndex } = shuffleOptions(rng, fmt(good), bad.map(fmt));
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
