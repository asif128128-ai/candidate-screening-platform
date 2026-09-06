// reasoning.table_must_be_true — ASSESSMENT_DESIGN.md §3.2. N-row table;
// which of 4 statements *must* be true (not merely could be true)?
//
// Each candidate statement is "exactly K rows satisfy predicate P"; for the
// correct statement K is the row count actually satisfying P, and for the
// three distractors K is deliberately wrong (by construction, not by
// chance) so falseness is guaranteed rather than merely likely.
//
// Difficulty scales on three axes: row count (more rows to scan), predicate
// complexity (single-field at d1/d2 vs. two-field AND/OR combinations at
// d3), and distractor closeness (large, obvious offsets at d1 vs. ±1
// near-misses at d3 that force an exact count instead of a rough estimate).
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

const TEAMS = ["צפון", "דרום", "מרכז", "שרון"];
const STATUSES = ["פתוח", "בטיפול", "סגור"];

interface Row {
  id: number;
  team: string;
  status: string;
  priority: number;
  hours: number;
}

interface Predicate {
  desc: string;
  test: (r: Row) => boolean;
}

function renderTable(rows: Row[]): string {
  // B3 (FINTECH_REDESIGN_PLAN.md §4): "שעות פתיחה" read as "opening hours"
  // rather than "hours since the ticket opened".
  const header = "| id | צוות | סטטוס | עדיפות | שעות מאז הפתיחה |";
  const sep = "|---|---|---|---|---|";
  const body = rows.map((r) => `| ${r.id} | ${r.team} | ${r.status} | ${r.priority} | ${r.hours} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}

function buildPredicates(rng: Rng, difficulty: Difficulty): Predicate[] {
  const team = rng.pick(TEAMS);
  const team2 = rng.pick(TEAMS.filter((t) => t !== team));
  const status = rng.pick(STATUSES);
  const hoursThreshold = rng.pick([12, 24, 36, 48]);
  const simple: Predicate[] = [
    { desc: `סטטוס = "${status}"`, test: (r) => r.status === status },
    { desc: "עדיפות = 3", test: (r) => r.priority === 3 },
    { desc: `צוות = "${team}"`, test: (r) => r.team === team },
    { desc: `שעות פתיחה גדול מ-${hoursThreshold}`, test: (r) => r.hours > hoursThreshold },
    { desc: 'סטטוס שונה מ-"סגור"', test: (r) => r.status !== "סגור" },
  ];
  if (difficulty !== 3) return simple;
  // d3: compound (two-field) predicates — the "must be true" count now
  // requires combining two conditions per row, not one column lookup.
  const compound: Predicate[] = [
    { desc: `צוות = "${team}" וגם עדיפות = 3`, test: (r) => r.team === team && r.priority === 3 },
    {
      desc: `סטטוס = "${status}" וגם שעות פתיחה גדול מ-${hoursThreshold}`,
      test: (r) => r.status === status && r.hours > hoursThreshold,
    },
    { desc: `צוות = "${team}" או צוות = "${team2}"`, test: (r) => r.team === team || r.team === team2 },
    {
      desc: `עדיפות = 3 וגם סטטוס שונה מ-"סגור"`,
      test: (r) => r.priority === 3 && r.status !== "סגור",
    },
  ];
  return [...simple, ...compound];
}

export const template: ItemTemplate = {
  id: "reasoning.table_must_be_true",
  // v2: FINTECH_REDESIGN_PLAN.md round-2 §R2.2 confirms round-1's B3 fix
  // (drop the English "(must be true)" gloss, reword the header/statement
  // text) never actually landed — done now.
  version: 2,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    // d1: fewer rows, less scanning. d2: the original 6-row baseline. d3:
    // more rows plus compound predicates (see buildPredicates).
    const rowCount = difficulty === 1 ? 5 : difficulty === 2 ? 6 : 9;
    const rows: Row[] = Array.from({ length: rowCount }, (_, i) => ({
      id: i + 1,
      team: rng.pick(TEAMS),
      status: rng.pick(STATUSES),
      priority: rng.nextIntBetween(1, 3),
      hours: rng.nextIntBetween(1, 72),
    }));

    const predicates = rng.sample(buildPredicates(rng, difficulty), 4);
    const correctIdxInPredicates = rng.nextInt(predicates.length);

    // d1 distractors are off by a large, easy-to-rule-out margin; d3
    // distractors are near-misses (±1) that force an exact count instead of
    // a rough estimate.
    const deltas = difficulty === 1 ? [3, -3, 2, -2] : difficulty === 2 ? [1, -1, 2, -2, 3] : [1, -1];

    const statements = predicates.map((p, i) => {
      const actual = rows.filter(p.test).length;
      let stated = actual;
      if (i !== correctIdxInPredicates) {
        // Guarantee a wrong K: shift away from actual, staying non-negative,
        // and never colliding with actual by construction.
        for (const d of deltas) {
          if (actual + d >= 0 && actual + d !== actual) {
            stated = actual + d;
            break;
          }
        }
      }
      return { text: `בדיוק ${stated} כרטיסים מקיימים: ${p.desc}`, correct: i === correctIdxInPredicates };
    });

    const table = renderTable(rows);
    const prompt = `${table}\n\nאיזה מהמשפטים הבאים נכון לפי הטבלה?`;

    const tagged = rng.shuffle(statements);
    const correctIndex = tagged.findIndex((o) => o.correct);

    return {
      content: { prompt, options: tagged.map((o) => o.text) },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
