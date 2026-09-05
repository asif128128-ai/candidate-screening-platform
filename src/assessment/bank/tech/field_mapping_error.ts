// tech.field_mapping_error — ASSESSMENT_DESIGN.md §3.4. Two systems' field
// lists + a proposed mapping -> the one wrong row.
//
// Ground truth is per-row: each source field has one obviously-correct
// target by meaning. The proposed mapping table uses the correct target for
// every row except one, which is corrupted to a plausible-but-wrong target
// (not required to keep the mapping a bijection — a real mapping tool lets
// you point two fields at the same target by mistake, which is exactly the
// bug being tested for).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

interface FieldPair {
  source: string;
  target: string;
}

interface Case {
  pairs: FieldPair[]; // pairs[i].source correctly maps to pairs[i].target
}

const CASES: Case[] = [
  {
    pairs: [
      { source: "full_name", target: "Name" },
      { source: "email_address", target: "Email" },
      { source: "signup_date", target: "CreatedAt" },
      { source: "country_code", target: "Country" },
    ],
  },
  {
    pairs: [
      { source: "order_id", target: "OrderRef" },
      { source: "total_amount", target: "Amount" },
      { source: "currency", target: "Currency" },
      { source: "customer_email", target: "CustomerEmail" },
    ],
  },
  {
    pairs: [
      { source: "first_name", target: "GivenName" },
      { source: "last_name", target: "FamilyName" },
      { source: "phone_number", target: "Phone" },
      { source: "job_title", target: "Title" },
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.field_mapping_error",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const wrongIdx = rng.nextInt(c.pairs.length);
    // Corrupt the chosen row's target with another row's target from the
    // same case — plausible (it's a real field in the target system) but
    // wrong for this source field.
    const otherTargets = c.pairs.filter((_, i) => i !== wrongIdx).map((p) => p.target);
    const wrongTarget = rng.pick(otherTargets);

    const proposedRows = c.pairs.map((p, i) => (i === wrongIdx ? { source: p.source, target: wrongTarget } : p));

    const sourceFields = c.pairs.map((p) => p.source).join(", ");
    const targetFields = c.pairs.map((p) => p.target).join(", ");
    const table = proposedRows.map((r) => `| ${r.source} | ${r.target} |`).join("\n");

    const prompt =
      `שדות מקור (מערכת A): ${sourceFields}\nשדות יעד (מערכת B): ${targetFields}\n\n` +
      `המיפוי המוצע בין שתי המערכות:\n\n| שדה מקור | שדה יעד |\n|---|---|\n${table}\n\n` +
      "איזו שורה במיפוי שגויה?";

    const correctText = `${proposedRows[wrongIdx]?.source} -> ${proposedRows[wrongIdx]?.target}`;
    const wrongOptions = proposedRows
      .filter((_, i) => i !== wrongIdx)
      .map((r) => `${r.source} -> ${r.target}`);

    const tagged = rng.shuffle([
      { text: correctText, correct: true },
      ...wrongOptions.map((text) => ({ text, correct: false })),
    ]);
    const correctIndex = tagged.findIndex((o) => o.correct);

    return {
      content: { prompt, options: tagged.map((o) => o.text) },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
