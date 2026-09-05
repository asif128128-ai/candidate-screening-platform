// reasoning.constraints_seating — ASSESSMENT_DESIGN.md §3.2. 4-5 entities,
// 3-4 constraints; which assignment is forced?
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";
import { NAME_POOL, shuffleOptions } from "../helpers";

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) result.push([arr[i] as T, ...p]);
  }
  return result;
}

interface Constraint {
  text: string;
  test: (order: string[]) => boolean;
}

function buildConstraints(rng: Rng, people: string[]): Constraint[] {
  const candidates: Constraint[] = [];
  const [a, b, c, d, e] = people;
  if (a && b) {
    candidates.push({
      text: `${a} יושב/ת מיד משמאל ל${b}`,
      test: (o) => o.indexOf(b) === o.indexOf(a) + 1,
    });
  }
  if (c && d) {
    candidates.push({
      text: `${c} לא יושב/ת בקצה (לא במקום הראשון ולא באחרון)`,
      test: (o) => o.indexOf(c) !== 0 && o.indexOf(c) !== o.length - 1,
    });
    candidates.push({
      text: `${d} יושב/ת באחד משני הקצוות`,
      test: (o) => o.indexOf(d) === 0 || o.indexOf(d) === o.length - 1,
    });
  }
  if (b && c) {
    candidates.push({
      text: `${b} יושב/ת לפני ${c} (לא בהכרח מיד לפניו/ה)`,
      test: (o) => o.indexOf(b) < o.indexOf(c),
    });
  }
  if (a && e) {
    candidates.push({
      text: `${a} ו${e} לא יושבים זה לצד זה`,
      test: (o) => Math.abs(o.indexOf(a) - o.indexOf(e)) !== 1,
    });
  }
  if (a && c) {
    candidates.push({
      text: `יש בדיוק אדם אחד בין ${a} ל${c}`,
      test: (o) => Math.abs(o.indexOf(a) - o.indexOf(c)) === 2,
    });
  }
  return candidates;
}

export const template: ItemTemplate = {
  id: "reasoning.constraints_seating",
  version: 1,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const n = difficulty === 1 ? 4 : 5;
    const people = rng.sample(NAME_POOL, n);
    const allOrders = permutations(people);

    const numConstraints = difficulty === 3 ? 4 : 3;
    let chosenConstraints: Constraint[] = [];
    let survivors: string[][] = [];

    // Try random constraint subsets until exactly one seating order survives
    // all of them (guaranteed forced assignment), retrying deterministically
    // via the same rng stream.
    for (let attempt = 0; attempt < 200; attempt++) {
      const pool = buildConstraints(rng, rng.shuffle(people));
      if (pool.length < numConstraints) continue;
      const subset = rng.sample(pool, numConstraints);
      const remaining = allOrders.filter((o) => subset.every((c) => c.test(o)));
      if (remaining.length === 1) {
        chosenConstraints = subset;
        survivors = remaining;
        break;
      }
    }

    if (survivors.length !== 1) {
      // Deterministic fallback: force the very first permutation to be the
      // unique answer via an exact ordering constraint chain, guaranteeing
      // termination even if random constraint search above is unlucky.
      const forced = allOrders[0] as string[];
      chosenConstraints = forced.slice(0, -1).map((p, i) => ({
        text: `${p} יושב/ת מיד משמאל ל${forced[i + 1]}`,
        test: (o: string[]) => o.indexOf(forced[i + 1] as string) === o.indexOf(p) + 1,
      }));
      survivors = [forced];
    }

    const correctOrder = survivors[0] as string[];
    const wrongOrders = rng.sample(
      allOrders.filter((o) => o.join() !== correctOrder.join()),
      3,
    );

    const fmt = (o: string[]) => o.join(" · ");
    const prompt =
      `${n} אנשים (${people.join(", ")}) יושבים בשורה של ${n} מקומות, משמאל לימין. ידוע:\n` +
      chosenConstraints.map((c, i) => `${i + 1}. ${c.text}`).join("\n") +
      "\n\nאיזה סידור ישיבה מתאים לכל התנאים?";

    const { options, correctIndex } = shuffleOptions(rng, fmt(correctOrder), wrongOrders.map(fmt));
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
