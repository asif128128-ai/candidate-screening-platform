// reasoning.grid_pattern — ASSESSMENT_DESIGN.md §3.2 worked example 5.
// 3x3 SVG matrix; rows vary shape, columns vary count, fill alternates by
// diagonal. The 9th cell is missing; 6 SVG options, exactly one satisfies
// all three rules (each distractor violates exactly one rule by
// construction, per the generator's uniqueness proof).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";

type Shape = "circle" | "square" | "triangle";
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const COUNTS = [1, 2, 3];

function cellSvg(shape: Shape, count: number, filled: boolean): string {
  const fillColor = filled ? "#333333" : "none";
  const cxByCount: Record<number, number[]> = { 1: [50], 2: [32, 68], 3: [20, 50, 80] };
  const positions = cxByCount[count] ?? [50];
  const parts = positions.map((cx) => {
    if (shape === "circle") {
      return `<circle cx="${cx}" cy="50" r="12" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
    }
    if (shape === "square") {
      return `<rect x="${cx - 12}" y="38" width="24" height="24" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
    }
    return `<polygon points="${cx},36 ${cx - 14},62 ${cx + 14},62" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
  });
  return `<svg viewBox="0 0 100 100" width="72" height="72" role="img" aria-label="${shape} x${count} ${filled ? "מלא" : "ריק"}">${parts.join("")}</svg>`;
}

function fillFor(r: number, c: number): boolean {
  return (r + c) % 2 === 0;
}

export const template: ItemTemplate = {
  id: "reasoning.grid_pattern",
  version: 1,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const shapes = rng.shuffle(SHAPES);
    // Build the visible 8 cells (row = shape, column = count) as an SVG grid description string.
    const rows: string[][] = [];
    for (let r = 0; r < 3; r++) {
      const row: string[] = [];
      for (let c = 0; c < 3; c++) {
        if (r === 2 && c === 2) {
          row.push(""); // missing cell, rendered as "?" by the runner
        } else {
          row.push(cellSvg(shapes[r] as Shape, COUNTS[c] as number, fillFor(r, c)));
        }
      }
      rows.push(row);
    }

    const missingShape = shapes[2] as Shape;
    const missingCount = COUNTS[2] as number;
    const missingFill = fillFor(2, 2);
    const correctSvg = cellSvg(missingShape, missingCount, missingFill);

    const otherShapes = SHAPES.filter((s) => s !== missingShape);
    const otherCounts = COUNTS.filter((c) => c !== missingCount);

    // Each distractor violates exactly one rule (shape xor count xor fill).
    const distractors = [
      cellSvg(otherShapes[0] as Shape, missingCount, missingFill),
      cellSvg(otherShapes[1] as Shape, missingCount, missingFill),
      cellSvg(missingShape, otherCounts[0] as number, missingFill),
      cellSvg(missingShape, otherCounts[1] as number, missingFill),
      cellSvg(missingShape, missingCount, !missingFill),
    ];

    const gridText = rows.map((row) => row.map((cell) => (cell === "" ? "[?]" : "[תא]")).join(" ")).join("\n");
    const prompt =
      "לפניכם רשת 3x3 עם שלושה כללים: כל שורה משתמשת בצורה קבועה, כל עמודה קובעת את מספר הצורות בתא, והמילוי (מלא/ריק) מתחלף לפי האלכסון. התא הימני-תחתון חסר.\n\n" +
      `מבנה הרשת (השורות מייצגות צורות שונות, העמודות כמות שונה):\n${gridText}\n\n` +
      "בחרו את התא שמשלים את הרשת כך שכל שלושת הכללים מתקיימים.";

    const options = rng.shuffle([correctSvg, ...distractors]);
    const correctIndex = options.indexOf(correctSvg);

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
