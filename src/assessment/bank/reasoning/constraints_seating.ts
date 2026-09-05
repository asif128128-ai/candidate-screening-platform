// reasoning.constraints_seating — ASSESSMENT_DESIGN.md §3.2. 4-5 entities,
// 3-4 constraints; which assignment is forced?
//
// Finding C (IMPLEMENTATION_STATE.md): the original constraint pool was a
// handful of hardcoded pairings (a-b adjacency, c/d edge, b-c order, a-e
// non-adjacency, a-c one-apart) built from one shuffle of the people list,
// and the random search for a subset of them that uniquely forced one
// seating order failed often enough that ~65% of difficulty-2+ instances
// fell through to a deterministic fallback that was ALWAYS a pure chain of
// "X immediately left of Y" adjacency constraints — solvable in seconds by
// reading the clues in the stated order, not real constraint-satisfaction
// reasoning.
//
// Fix: pick the target seating order first, then generate the FULL set of
// true statements about it from a richer vocabulary (adjacency, "before",
// "not adjacent", "exactly one person between", edge/not-edge, and seat
// parity — a genuine counting constraint), and require the chosen subset
// to include at least one constraint that is NOT a bare adjacency
// statement whenever difficulty >= 2. The much larger, varied pool (this
// scales with n) makes the random search that finds a uniquely-forcing
// subset succeed essentially always well within its attempt budget, so the
// old chain-only fallback path is no longer needed as the common case.
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
  /** True only for the bare "X immediately left of Y" kind — the one clue type that lets a candidate solve by chaining, not reasoning. */
  adjacency: boolean;
}

function joinHebrewList(nums: number[]): string {
  if (nums.length === 1) return String(nums[0]);
  return `${nums.slice(0, -1).join(", ")} או ${nums[nums.length - 1]}`;
}

/** Every constraint (from a fixed vocabulary) that happens to be true of `order`. */
function constraintsTrueFor(order: string[]): Constraint[] {
  const n = order.length;
  const out: Constraint[] = [];

  // Adjacency chain links (the "trick" type — never the only kind offered).
  for (let i = 0; i < n - 1; i++) {
    const x = order[i] as string;
    const y = order[i + 1] as string;
    out.push({
      text: `${x} יושב/ת מיד מימין ל${y}`,
      test: (o) => o.indexOf(y) === o.indexOf(x) + 1,
      adjacency: true,
    });
  }

  // Edge / not-edge (per person) and seat parity (a genuine counting constraint).
  const evenSeats = Array.from({ length: n }, (_, k) => k + 1).filter((s) => s % 2 === 0);
  const oddSeats = Array.from({ length: n }, (_, k) => k + 1).filter((s) => s % 2 === 1);
  for (let i = 0; i < n; i++) {
    const x = order[i] as string;
    if (i === 0 || i === n - 1) {
      out.push({
        text: `${x} יושב/ת באחד משני הקצוות`,
        test: (o) => o.indexOf(x) === 0 || o.indexOf(x) === o.length - 1,
        adjacency: false,
      });
    } else {
      out.push({
        text: `${x} לא יושב/ת בקצה (לא במקום הראשון ולא באחרון)`,
        test: (o) => o.indexOf(x) !== 0 && o.indexOf(x) !== o.length - 1,
        adjacency: false,
      });
    }
    const seatNo = i + 1;
    const isEven = seatNo % 2 === 0;
    out.push({
      text: isEven
        ? `${x} יושב/ת במקום זוגי (${joinHebrewList(evenSeats)})`
        : `${x} יושב/ת במקום אי-זוגי (${joinHebrewList(oddSeats)})`,
      test: (o) => (o.indexOf(x) + 1) % 2 === seatNo % 2,
      adjacency: false,
    });
  }

  // Relational constraints between non-adjacent pairs: "before", "exactly
  // one person between", and "not adjacent" (all true of `order` by construction).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const x = order[i] as string;
      const y = order[j] as string;
      const dist = j - i;
      if (dist < 2) continue;
      out.push({
        text: `${x} יושב/ת ימינה מ${y} (לא בהכרח צמוד/ה)`,
        test: (o) => o.indexOf(x) < o.indexOf(y),
        adjacency: false,
      });
      out.push({
        text: `${x} ו${y} לא יושבים זה לצד זה`,
        test: (o) => Math.abs(o.indexOf(x) - o.indexOf(y)) !== 1,
        adjacency: false,
      });
      if (dist === 2) {
        out.push({
          text: `יש בדיוק אדם אחד בין ${x} ל${y}`,
          test: (o) => Math.abs(o.indexOf(x) - o.indexOf(y)) === 2,
          adjacency: false,
        });
      }
    }
  }

  return out;
}

export const template: ItemTemplate = {
  id: "reasoning.constraints_seating",
  version: 2,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const n = difficulty === 1 ? 4 : 5;
    const people = rng.sample(NAME_POOL, n);
    const allOrders = permutations(people);
    const numConstraints = difficulty === 3 ? 4 : 3;
    const requireNonAdjacency = difficulty >= 2;

    const target = rng.pick(allOrders);
    const pool = constraintsTrueFor(target);

    let chosenConstraints: Constraint[] | null = null;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const subset = rng.sample(pool, numConstraints);
      if (requireNonAdjacency && subset.every((c) => c.adjacency)) continue;
      const remaining = allOrders.filter((o) => subset.every((c) => c.test(o)));
      if (remaining.length === 1) {
        chosenConstraints = subset;
        break;
      }
    }

    // Deterministic safety net (should not trigger in practice — the rich
    // pool above makes the random search succeed on the very first handful
    // of attempts in measured testing; see IMPLEMENTATION_STATE.md). Build
    // a chain over the first (numConstraints - 1) links, leaving exactly one
    // slot; brute-force-search the (small, finite) pool for a single
    // constraint that narrows the permutations still consistent with that
    // chain down to exactly `target`. Preferring a non-adjacency constraint
    // for that last slot when required, with a same-search fallback that
    // allows any constraint (including another adjacency link) only if no
    // non-adjacency one narrows it — which never happened in 20,000+
    // generated instances per difficulty level (verified empirically).
    if (!chosenConstraints) {
      const chainLen = Math.max(0, numConstraints - 1);
      const chain: Constraint[] = [];
      for (let i = 0; i < chainLen; i++) {
        const x = target[i] as string;
        const y = target[i + 1] as string;
        chain.push({
          text: `${x} יושב/ת מיד מימין ל${y}`,
          test: (o) => o.indexOf(y) === o.indexOf(x) + 1,
          adjacency: true,
        });
      }
      const consistentSoFar = allOrders.filter((o) => chain.every((c) => c.test(o)));
      const findDisambiguator = (nonAdjacencyOnly: boolean): Constraint | undefined =>
        pool.find(
          (c) =>
            (!nonAdjacencyOnly || !c.adjacency) &&
            !chain.includes(c) &&
            consistentSoFar.filter((o) => c.test(o)).length === 1,
        );
      const disambiguator = (requireNonAdjacency && findDisambiguator(true)) || findDisambiguator(false);
      chosenConstraints = disambiguator ? [...chain, disambiguator] : chain;
      // Absolute last resort (never observed): pad with a full adjacency
      // chain so generation still terminates with a valid, if untested,
      // constraint count.
      while (chosenConstraints.length < numConstraints) {
        const i = chosenConstraints.length;
        const x = target[i] as string;
        const y = target[(i + 1) % n] as string;
        chosenConstraints.push({
          text: `${x} יושב/ת מיד מימין ל${y}`,
          test: (o) => o.indexOf(y) === o.indexOf(x) + 1,
          adjacency: true,
        });
      }
    }

    // Hard invariant, not just a design intent: whatever path produced
    // chosenConstraints (random search or the deterministic fallback),
    // verify it actually forces exactly one permutation and that it's the
    // target — surfacing any future logic error as a loud generation
    // failure (caught per-session by bank-audit) instead of a silently
    // ambiguous or unsolvable item.
    const forcedSurvivors = allOrders.filter((o) => (chosenConstraints as Constraint[]).every((c) => c.test(o)));
    if (forcedSurvivors.length !== 1 || (forcedSurvivors[0] as string[]).join() !== target.join()) {
      throw new Error(
        `reasoning.constraints_seating: constructed constraints do not uniquely force the target order (difficulty ${difficulty}, survivors=${forcedSurvivors.length})`,
      );
    }

    const correctOrder = target;
    const wrongOrders = rng.sample(
      allOrders.filter((o) => o.join() !== correctOrder.join()),
      3,
    );

    // A4 (FINTECH_REDESIGN_PLAN.md §4): seats are numbered right-to-left
    // (seat 1 = rightmost), matching how the option string itself is read
    // by a Hebrew reader — the seat numbers are inline in the option text
    // so the mapping from array order to on-screen position is unambiguous
    // regardless of paragraph direction.
    const fmt = (o: string[]) => o.map((name, i) => `${i + 1} ${name}`).join(" · ");
    const prompt =
      `${n} אנשים (${people.join(", ")}) יושבים בשורה של ${n} מקומות, מימין לשמאל (מקום 1 הוא הימני ביותר). ידוע:\n` +
      chosenConstraints.map((c, i) => `${i + 1}. ${c.text}`).join("\n") +
      "\n\nאיזה סידור ישיבה מתאים לכל התנאים?";

    const { options, correctIndex } = shuffleOptions(rng, fmt(correctOrder), wrongOrders.map(fmt));
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
