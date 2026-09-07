// knowledge.units_bigger — which of two quantities is larger, across the units
// this role reads daily (storage, time, throughput).
// ASSESSMENT_DESIGN.md §3.5. Answering needs the scale to be genuinely known
// (1 GB = 1024 MB, 1 s = 1000 ms), not computed — which is exactly the kind of
// thing someone who has never sized a disk or read a latency graph gets wrong.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Unit {
  label: string;
  /** Value of one of this unit in the family's base unit. */
  factor: number;
  family: string;
}

const UNITS: Unit[] = [
  { label: "KB", factor: 1, family: "size" },
  { label: "MB", factor: 1024, family: "size" },
  { label: "GB", factor: 1024 * 1024, family: "size" },
  { label: "TB", factor: 1024 * 1024 * 1024, family: "size" },
  { label: "ms", factor: 1, family: "time" },
  { label: "שניות", factor: 1000, family: "time" },
  { label: "דקות", factor: 60_000, family: "time" },
  { label: "שעות", factor: 3_600_000, family: "time" },
];

function render(amount: number, unit: Unit): string {
  return `${amount} ${unit.label}`;
}

export const template: ItemTemplate = {
  id: "knowledge.units_bigger",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const family = rng.pick(["size", "time"]);
    const pool = UNITS.filter((u) => u.family === family);

    // Four quantities in the same family, all with distinct real values, so
    // exactly one is largest and no two options can render identically.
    const seen = new Set<number>();
    const entries: Array<{ text: string; value: number }> = [];
    for (let attempt = 0; attempt < 200 && entries.length < 4; attempt++) {
      const unit = rng.pick(pool);
      const amount = rng.nextIntBetween(2, 900);
      const value = amount * unit.factor;
      if (seen.has(value)) continue;
      seen.add(value);
      entries.push({ text: render(amount, unit), value });
    }

    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const correct = sorted[0] as { text: string; value: number };
    const distractors = sorted.slice(1).map((e) => e.text);
    const { options, correctIndex } = shuffleOptions(rng, correct.text, distractors);

    return {
      content: { prompt: "איזה מהערכים הבאים הוא הגדול ביותר?", options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
