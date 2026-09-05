// reasoning.table_must_be_true — ASSESSMENT_DESIGN.md §3.2. 6-row table;
// which of 4 statements *must* be true (not merely could be true)?
//
// Each candidate statement is "exactly K rows satisfy predicate P"; for the
// correct statement K is the row count actually satisfying P, and for the
// three distractors K is deliberately wrong (by construction, not by
// chance) so falseness is guaranteed rather than merely likely.
import type { ItemTemplate } from "../../types";
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
  const header = "| id | צוות | סטטוס | עדיפות | שעות פתיחה |";
  const sep = "|---|---|---|---|---|";
  const body = rows.map((r) => `| ${r.id} | ${r.team} | ${r.status} | ${r.priority} | ${r.hours} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}

function buildPredicates(rng: Rng): Predicate[] {
  const team = rng.pick(TEAMS);
  const status = rng.pick(STATUSES);
  const hoursThreshold = rng.pick([12, 24, 36, 48]);
  return [
    { desc: `סטטוס = "${status}"`, test: (r) => r.status === status },
    { desc: "עדיפות = 3", test: (r) => r.priority === 3 },
    { desc: `צוות = "${team}"`, test: (r) => r.team === team },
    { desc: `שעות פתיחה גדול מ-${hoursThreshold}`, test: (r) => r.hours > hoursThreshold },
    { desc: 'סטטוס שונה מ-"סגור"', test: (r) => r.status !== "סגור" },
  ];
}

export const template: ItemTemplate = {
  id: "reasoning.table_must_be_true",
  version: 1,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      team: rng.pick(TEAMS),
      status: rng.pick(STATUSES),
      priority: rng.nextIntBetween(1, 3),
      hours: rng.nextIntBetween(1, 72),
    }));

    const predicates = rng.sample(buildPredicates(rng), 4);
    const correctIdxInPredicates = rng.nextInt(predicates.length);

    const statements = predicates.map((p, i) => {
      const actual = rows.filter(p.test).length;
      let stated = actual;
      if (i !== correctIdxInPredicates) {
        // Guarantee a wrong K: shift away from actual, staying non-negative,
        // and never colliding with actual by construction.
        const deltas = [1, -1, 2, -2, 3];
        for (const d of deltas) {
          if (actual + d >= 0 && actual + d !== actual) {
            stated = actual + d;
            break;
          }
        }
      }
      return { text: `יש בדיוק ${stated} כרטיסים שעונים על: ${p.desc}.`, correct: i === correctIdxInPredicates };
    });

    const table = renderTable(rows);
    const prompt = `${table}\n\nאיזה מהמשפטים הבאים חייב להיות נכון (must be true) לפי הטבלה בפועל?`;

    const tagged = rng.shuffle(statements);
    const correctIndex = tagged.findIndex((o) => o.correct);

    return {
      content: { prompt, options: tagged.map((o) => o.text) },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
