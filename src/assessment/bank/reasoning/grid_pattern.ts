// reasoning.grid_pattern — ASSESSMENT_DESIGN.md §3.2 worked example 5.
// 3x3 SVG matrix; the 9th cell is missing and must be inferred.
//
// Difficulty scales on rule count and on whether the rules are told to the
// candidate or must be induced from the 8 visible cells: d1 uses only two
// rules (shape-by-row, count-by-column) and states them; d2 is the original
// three-rule version (shape/count/fill), rules stated; d3 keeps all three
// rules but does NOT state them — the grid itself is the only "convention"
// (every fact needed is visible in the 8 filled cells, so this stays
// consistent with the bank-wide "the convention is in the item" rule, it
// just isn't spelled out in prose) — and adds a distractor that violates two
// rules at once, which looks plausible at a glance but fails under a full
// check of every rule.
import type { Difficulty, ItemTemplate } from "../../types";
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
  generate(rng: Rng, difficulty: Difficulty) {
    const useFillRule = difficulty !== 1; // d1 drops the diagonal-fill rule entirely.
    const stateRulesExplicitly = difficulty !== 3; // d3 must be induced from the grid alone.

    const shapes = rng.shuffle(SHAPES);
    const fillOf = (r: number, c: number): boolean => (useFillRule ? fillFor(r, c) : true);

    // Build the visible 8 cells (row = shape, column = count) as an SVG grid description string.
    const rows: string[][] = [];
    for (let r = 0; r < 3; r++) {
      const row: string[] = [];
      for (let c = 0; c < 3; c++) {
        if (r === 2 && c === 2) {
          row.push(""); // missing cell, rendered as "?" by the runner
        } else {
          row.push(cellSvg(shapes[r] as Shape, COUNTS[c] as number, fillOf(r, c)));
        }
      }
      rows.push(row);
    }

    const missingShape = shapes[2] as Shape;
    const missingCount = COUNTS[2] as number;
    const missingFill = fillOf(2, 2);
    const correctSvg = cellSvg(missingShape, missingCount, missingFill);

    const otherShapes = SHAPES.filter((s) => s !== missingShape);
    const otherCounts = COUNTS.filter((c) => c !== missingCount);

    // Each single-rule distractor violates exactly one rule (shape xor count
    // xor fill). d1 has no fill rule, so it only needs shape/count violations.
    const distractors = [
      cellSvg(otherShapes[0] as Shape, missingCount, missingFill),
      cellSvg(otherShapes[1] as Shape, missingCount, missingFill),
      cellSvg(missingShape, otherCounts[0] as number, missingFill),
      ...(useFillRule
        ? [cellSvg(missingShape, otherCounts[1] as number, missingFill), cellSvg(missingShape, missingCount, !missingFill)]
        : []),
    ];

    if (difficulty === 3) {
      // A double-violation option (wrong shape AND wrong fill) — looks
      // plausible at a glance since two of the three checks still "feel"
      // close, but fails once every rule is actually verified.
      distractors.push(cellSvg(otherShapes[0] as Shape, missingCount, !missingFill));
    }

    const gridText = rows.map((row) => row.map((cell) => (cell === "" ? "[?]" : "[תא]")).join(" ")).join("\n");

    const ruleSentence = stateRulesExplicitly
      ? useFillRule
        ? "לפניכם רשת 3x3 עם שלושה כללים: כל שורה משתמשת בצורה קבועה, כל עמודה קובעת את מספר הצורות בתא, והמילוי (מלא/ריק) מתחלף לפי האלכסון. התא הימני-תחתון חסר."
        : "לפניכם רשת 3x3 עם שני כללים: כל שורה משתמשת בצורה קבועה, וכל עמודה קובעת את מספר הצורות בתא. התא הימני-תחתון חסר."
      : "לפניכם רשת 3x3 שבה 8 מתוך 9 התאים גלויים. הרשת בנויה לפי כללים קבועים (לא מפורטים) שניתן להסיק אותם ישירות מהתאים הגלויים. התא הימני-תחתון חסר.";

    const instruction = stateRulesExplicitly
      ? `בחרו את התא שמשלים את הרשת כך שכל ${useFillRule ? "שלושת" : "שני"} הכללים מתקיימים.`
      : "בחרו את התא שמשלים את הרשת בהתאם לתבנית שאפשר להסיק מהתאים הגלויים.";

    const prompt =
      `${ruleSentence}\n\n` +
      `מבנה הרשת (השורות מייצגות צורות שונות, העמודות כמות שונה):\n${gridText}\n\n` +
      instruction;

    const options = rng.shuffle([correctSvg, ...distractors]);
    const correctIndex = options.indexOf(correctSvg);

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
