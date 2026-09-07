// Shared builders for the knowledge block (ASSESSMENT_DESIGN.md §3.5).
//
// This block deliberately breaks the bank's "the convention is in the item"
// rule (§3): every other family states any convention it relies on so the test
// never re-measures prior exposure. Here recall IS the measurement — the
// client wants to know whether a candidate has actually been around
// technology, not only whether they can reason. The tradeoff is stated in
// DECISIONS_LOG.md #25 and defended by two things: the terms are deliberately
// general (what DNS is, not what a 429 means), so this measures curiosity
// rather than a particular internship; and the 15 s limit is what keeps the
// items honest, since a candidate who knows answers in 3 s while a phone LLM
// round trip needs 11-12 s at its very fastest.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

export interface TermEntry {
  /** The thing being asked about (rendered into the prompt). */
  term: string;
  /** Its short, plain-Hebrew meaning — this is the correct option. */
  meaning: string;
}

/**
 * Builds a "what is X?" family: the prompt names one term, and the four
 * options are its meaning plus three meanings drawn from *other* entries in
 * the same pool. Distractors being real meanings of sibling terms is what
 * makes the item discriminate — a candidate who half-knows the area sees four
 * plausible technical sentences, not one real answer and three jokes.
 *
 * Options are unique by construction as long as every `meaning` in the pool is
 * distinct, which the unit test asserts per family.
 */
export function defineTermTemplate(config: {
  id: string;
  /** Renders the question for a drawn term, e.g. (t) => `מה זה ${t}?` */
  ask: (term: string) => string;
  pool: readonly TermEntry[];
}): ItemTemplate {
  return {
    id: config.id,
    version: 1,
    pillar: "tech",
    kind: "single_choice",
    difficulties: [1],
    conventionsStated: "n/a",
    generate(rng: Rng) {
      const drawn = rng.sample(config.pool, 4);
      const correct = drawn[0] as TermEntry;
      const distractors = drawn.slice(1).map((e) => e.meaning);
      const { options, correctIndex } = shuffleOptions(rng, correct.meaning, distractors);
      return {
        content: { prompt: config.ask(correct.term), options },
        answerKey: { kind: "single_choice", correctIndex },
      };
    },
  };
}

/**
 * Builds a "which one is valid?" family: one well-formed value against three
 * malformed ones, each broken in a *different* way so the item cannot be
 * solved by spotting a single repeated tell.
 */
export function defineValidityTemplate(config: {
  id: string;
  /** Renders the question for the drawn kind, e.g. (k) => `איזו ${k} תקינה?` */
  ask: (kindLabel: string) => string;
  kinds: readonly {
    label: string;
    valid: (rng: Rng) => string;
    /** Distinct ways to break it; three are drawn per item. */
    invalid: ReadonlyArray<(rng: Rng) => string>;
  }[];
}): ItemTemplate {
  return {
    id: config.id,
    version: 1,
    pillar: "tech",
    kind: "single_choice",
    difficulties: [1],
    conventionsStated: "n/a",
    generate(rng: Rng) {
      const kind = rng.pick(config.kinds);
      const correct = kind.valid(rng);

      // Draw three *different* breakages, then de-duplicate defensively: two
      // generators can coincidentally produce the same string, and identical
      // options would fail the bank audit's uniqueness invariant.
      const breakers = rng.sample(kind.invalid, Math.min(3, kind.invalid.length));
      const seen = new Set<string>([correct]);
      const distractors: string[] = [];
      for (const make of breakers) {
        for (let attempt = 0; attempt < 40 && distractors.length < 3; attempt++) {
          const v = make(rng);
          if (!seen.has(v)) {
            seen.add(v);
            distractors.push(v);
            break;
          }
        }
      }
      // If a kind offers fewer than three breakages (or they collided), top up
      // from the other breakers rather than shipping a 2-option item.
      for (let attempt = 0; attempt < 200 && distractors.length < 3; attempt++) {
        const v = rng.pick(kind.invalid)(rng);
        if (!seen.has(v)) {
          seen.add(v);
          distractors.push(v);
        }
      }

      const { options, correctIndex } = shuffleOptions(rng, correct, distractors);
      return {
        content: { prompt: config.ask(kind.label), options },
        answerKey: { kind: "single_choice", correctIndex },
      };
    },
  };
}
