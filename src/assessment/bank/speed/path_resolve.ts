// speed.path_resolve — ASSESSMENT_DESIGN.md §3.1 worked example 2. The two
// rules are stated in the item (DECISIONS_LOG.md #8).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

const RULE = "`..` פירושו \"תיקייה אחת למעלה\" ו-`.` פירושו \"אותה תיקייה\".";

const SEGMENT_POOL = ["srv", "app", "logs", "config", "env", "prod", "data", "shared", "tmp", "backup", "www"];

function resolvePath(parts: string[]): string[] {
  const stack: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") {
      stack.pop();
    } else {
      stack.push(p);
    }
  }
  return stack;
}

export const template: ItemTemplate = {
  id: "speed.path_resolve",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: RULE,
  fluency: true,
  generate(rng: Rng) {
    const base = rng.sample(SEGMENT_POOL, 3);
    const file = `${rng.pick(["prod", "app", "settings", "users"])}.yaml`;
    // Build a path with 1-2 ".." and one "." that resolves cleanly without
    // going above the root the segments started from.
    const parts = [...base, "..", rng.pick(SEGMENT_POOL), ".", rng.pick(SEGMENT_POOL), "..", file];
    const resolved = resolvePath(parts);
    const correct = `/${resolved.join("/")}`;
    const rawPath = `/${parts.join("/")}`;

    const distractors = generateDistinctDistractors(
      3,
      [correct],
      () => {
        const variant = rng.pick(["drop_last_dotdot", "keep_dot", "extra_up", "wrong_order"]);
        let s = resolved.slice();
        if (variant === "drop_last_dotdot" && s.length > 1) s = s.slice(0, -2).concat(s.slice(-1));
        if (variant === "keep_dot") s = [...base, ".", ...s.slice(base.length)];
        if (variant === "extra_up" && s.length > 0) s = s.slice(0, -1);
        if (variant === "wrong_order") s = rng.shuffle(s);
        return `/${s.join("/")}`;
      },
      (v) => v,
    );

    const prompt = `${RULE}\nמה הנתיב המלא שמתקבל מ-\`${rawPath}\`?`;
    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
