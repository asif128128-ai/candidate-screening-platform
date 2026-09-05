// tech.sql_outcome — ASSESSMENT_DESIGN.md §3.4. 8-row table + short
// SELECT ... WHERE ... GROUP BY -> result count/value. conventions_stated: n/a.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

const TEAMS = ["צפון", "דרום", "מרכז"];
const STATUSES = ["open", "closed"];

interface Row {
  id: number;
  team: string;
  status: string;
  amount: number;
}

function renderTable(rows: Row[]): string {
  const header = "| id | team | status | amount |";
  const sep = "|---|---|---|---|";
  const body = rows.map((r) => `| ${r.id} | ${r.team} | ${r.status} | ${r.amount} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}

export const template: ItemTemplate = {
  id: "tech.sql_outcome",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const rows: Row[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      team: rng.pick(TEAMS),
      status: rng.pick(STATUSES),
      amount: rng.nextIntBetween(50, 500),
    }));

    let query: string;
    let correctValue: number;

    if (difficulty === 1) {
      const status = rng.pick(STATUSES);
      query = `SELECT COUNT(*) FROM tickets WHERE status = '${status}';`;
      correctValue = rows.filter((r) => r.status === status).length;
    } else if (difficulty === 2) {
      const team = rng.pick(TEAMS);
      const status = rng.pick(STATUSES);
      query = `SELECT SUM(amount) FROM tickets WHERE team = '${team}' AND status = '${status}';`;
      correctValue = rows.filter((r) => r.team === team && r.status === status).reduce((s, r) => s + r.amount, 0);
    } else {
      const team = rng.pick(TEAMS);
      query = `SELECT status, COUNT(*) FROM tickets WHERE team = '${team}' GROUP BY status HAVING COUNT(*) >= 2;`;
      // Number of result ROWS: one row per status group within the team
      // that has 2 or more tickets.
      const counts = new Map<string, number>();
      for (const r of rows.filter((r2) => r2.team === team)) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      }
      correctValue = [...counts.values()].filter((c) => c >= 2).length;
    }

    const distractors = generateDistinctDistractors(
      3,
      [String(correctValue)],
      () => String(Math.max(0, correctValue + rng.pick([-3, -2, -1, 1, 2, 3, 4, 5]))),
      (v) => v,
    );

    const table = renderTable(rows);
    const questionLine =
      difficulty === 3 ? "כמה שורות (rows) תחזיר השאילתה?" : "מה התוצאה של השאילתה?";
    const prompt = `${table}\n\n\`\`\`sql\n${query}\n\`\`\`\n\n${questionLine}`;
    const { options, correctIndex } = shuffleOptions(rng, String(correctValue), distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
