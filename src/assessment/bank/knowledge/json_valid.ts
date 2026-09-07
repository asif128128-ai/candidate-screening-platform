// knowledge.json_valid — which of four snippets is valid JSON.
// ASSESSMENT_DESIGN.md §3.5. Every distractor is a mistake people actually
// make (trailing comma, unquoted key, single quotes, missing colon), so the
// item rewards having handled real JSON rather than having memorized a grammar.
import type { Rng } from "../../rng";
import { defineValidityTemplate } from "./helpers";

const KEYS = ["id", "status", "name", "amount", "active"];
const STRINGS = ["open", "closed", "dana", "pending"];

function pair(r: Rng): { k: string; v: string } {
  const k = r.pick(KEYS);
  const v = r.chance(0.5) ? `"${r.pick(STRINGS)}"` : String(r.nextIntBetween(1, 999));
  return { k, v };
}

export const template = defineValidityTemplate({
  id: "knowledge.json_valid",
  ask: () => "איזה מהקטעים הבאים הוא JSON תקין?",
  kinds: [
    {
      label: "JSON",
      valid: (r) => {
        const a = pair(r);
        const b = pair(r);
        return `{"${a.k}": ${a.v}, "${b.k}": ${b.v}}`;
      },
      // Every distractor carries the SAME two pairs as the valid option, and
      // differs only in the one thing that breaks it. The first version of
      // this family let several distractors be one-pair objects, which made
      // the correct answer the longest option 56% of the time — the bank
      // audit's longest-option gate (35%) caught it. A candidate must read the
      // punctuation, not compare lengths.
      invalid: [
        // Trailing comma.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{"${a.k}": ${a.v}, "${b.k}": ${b.v},}`;
        },
        // Unquoted key.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{${a.k}: ${a.v}, "${b.k}": ${b.v}}`;
        },
        // Single quotes instead of double.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{'${a.k}': ${a.v}, '${b.k}': ${b.v}}`;
        },
        // Missing colon.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{"${a.k}" ${a.v}, "${b.k}": ${b.v}}`;
        },
        // Unclosed brace.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{"${a.k}": ${a.v}, "${b.k}": ${b.v}`;
        },
        // Missing comma between pairs.
        (r) => {
          const a = pair(r);
          const b = pair(r);
          return `{"${a.k}": ${a.v} "${b.k}": ${b.v}}`;
        },
      ],
    },
  ],
});
