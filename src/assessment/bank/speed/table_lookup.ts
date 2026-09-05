// speed.table_lookup — ASSESSMENT_DESIGN.md §3.1. 6-row table; value of
// column Y where id = X. conventions_stated: n/a (plain table read).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { NAME_POOL, generateDistinctDistractors, shuffleOptions } from "../helpers";

const CITY_POOL = ["חיפה", "אשדוד", "רמת גן", "נתניה", "חולון", "רעננה", "לוד", "הרצליה"];
const STATUS_POOL = ["פעיל", "מושהה", "סגור", "בהמתנה"];

interface Column {
  name: string;
  gen: (rng: Rng) => string;
}

const COLUMNS: Column[] = [
  { name: "עיר", gen: (r) => r.pick(CITY_POOL) },
  { name: "סטטוס", gen: (r) => r.pick(STATUS_POOL) },
  { name: "שם", gen: (r) => r.pick(NAME_POOL) },
];

function renderTable(rows: Array<{ id: number; values: Record<string, string> }>, colNames: string[]): string {
  const header = `| id | ${colNames.join(" | ")} |`;
  const sep = `|---|${colNames.map(() => "---").join("|")}|`;
  const body = rows.map((r) => `| ${r.id} | ${colNames.map((c) => r.values[c]).join(" | ")} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}

export const template: ItemTemplate = {
  id: "speed.table_lookup",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const cols = rng.sample(COLUMNS, 2);
    const colNames = cols.map((c) => c.name);
    const ids = rng.shuffle([1, 2, 3, 4, 5, 6]).map((n) => n + rng.nextIntBetween(0, 3) * 10);
    const rows = ids.map((id) => ({
      id,
      values: Object.fromEntries(cols.map((c) => [c.name, c.gen(rng)])) as Record<string, string>,
    }));

    const targetRowIdx = rng.nextInt(rows.length);
    const targetRow = rows[targetRowIdx] as (typeof rows)[number];
    const targetCol = rng.pick(cols);
    const correctValue = targetRow.values[targetCol.name] as string;

    const table = renderTable(rows, colNames);
    const prompt =
      `${table}\n\nמה הערך בעמודה "${targetCol.name}" עבור id = ${targetRow.id}?`;

    const distractors = generateDistinctDistractors(
      3,
      [correctValue],
      () => targetCol.gen(rng),
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, correctValue, distractors);

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
