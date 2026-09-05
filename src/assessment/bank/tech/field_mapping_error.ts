// tech.field_mapping_error — ASSESSMENT_DESIGN.md §3.4. Two systems' field
// lists + a proposed mapping -> the one wrong row.
//
// Ground truth is per-row: each source field has one obviously-correct
// target by meaning. The proposed mapping table uses the correct target for
// every row except one, which is corrupted to a plausible-but-wrong target
// (not required to keep the mapping a bijection — a real mapping tool lets
// you point two fields at the same target by mistake, which is exactly the
// bug being tested for).
//
// d1 cases (below) have semantically distant targets, so a swapped row
// stands out immediately (e.g. a name mapped to "Email"). d2 cases use
// near-duplicate target pairs (billing vs. shipping, start vs. end) where
// the corrupted row is still a *plausible* field in the target system and
// requires actually checking each row against its meaning, not just
// scanning for an obviously-wrong-looking target.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

interface FieldPair {
  source: string;
  target: string;
}

interface Case {
  pairs: FieldPair[]; // pairs[i].source correctly maps to pairs[i].target
  /**
   * Hard cases only: which two row indices are the "confusable" pair (e.g.
   * billing vs. shipping). The corruption always swaps within this pair, so
   * the wrong target is always a genuine near-miss — never the unrelated
   * filler row, which would make the error trivially easy to spot again.
   */
  confusablePairIdx?: [number, number];
}

const CASES_EASY: Case[] = [
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

const CASES_HARD: Case[] = [
  {
    pairs: [
      { source: "billing_email", target: "BillingEmail" },
      { source: "shipping_email", target: "ShippingEmail" },
      { source: "billing_phone", target: "BillingPhone" },
      { source: "shipping_phone", target: "ShippingPhone" },
      { source: "customer_id", target: "CustomerId" },
    ],
    confusablePairIdx: [0, 1],
  },
  {
    pairs: [
      { source: "start_date", target: "StartDate" },
      { source: "end_date", target: "EndDate" },
      { source: "created_date", target: "CreatedAt" },
      { source: "updated_date", target: "UpdatedAt" },
      { source: "record_id", target: "RecordId" },
    ],
    confusablePairIdx: [0, 1],
  },
];

export const template: ItemTemplate = {
  id: "tech.field_mapping_error",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(difficulty === 1 ? CASES_EASY : CASES_HARD);

    let wrongIdx: number;
    let wrongTarget: string;
    if (c.confusablePairIdx) {
      // Corrupt within the designated confusable pair only, so the wrong
      // target is always a genuine near-miss (e.g. Billing <-> Shipping),
      // never an easy-to-spot swap with an unrelated filler field.
      const [a, b] = c.confusablePairIdx;
      [wrongIdx, wrongTarget] = rng.chance() ? [a, c.pairs[b]?.target as string] : [b, c.pairs[a]?.target as string];
    } else {
      wrongIdx = rng.nextInt(c.pairs.length);
      // Corrupt the chosen row's target with another row's target from the
      // same case — plausible (it's a real field in the target system) but
      // wrong for this source field.
      const otherTargets = c.pairs.filter((_, i) => i !== wrongIdx).map((p) => p.target);
      wrongTarget = rng.pick(otherTargets);
    }

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
