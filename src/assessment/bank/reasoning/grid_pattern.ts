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

/** Raw shape markup in the cell's own 0-100 coordinate space (no outer `<svg>` wrapper) — reused both standalone (option tiles) and composed into the 3x3 figure. */
function cellShapeMarkup(shape: Shape, count: number, filled: boolean): string {
  const fillColor = filled ? "#333333" : "none";
  const cxByCount: Record<number, number[]> = { 1: [50], 2: [32, 68], 3: [20, 50, 80] };
  const positions = cxByCount[count] ?? [50];
  return positions
    .map((cx) => {
      if (shape === "circle") {
        return `<circle cx="${cx}" cy="50" r="12" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
      }
      if (shape === "square") {
        return `<rect x="${cx - 12}" y="38" width="24" height="24" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
      }
      return `<polygon points="${cx},36 ${cx - 14},62 ${cx + 14},62" fill="${fillColor}" stroke="#222" stroke-width="3"/>`;
    })
    .join("");
}

/** A standalone, self-contained cell SVG — used as an `option` tile (candidates pick one of these to fill the missing cell). */
function cellSvg(shape: Shape, count: number, filled: boolean): string {
  return `<svg viewBox="0 0 100 100" width="72" height="72" role="img" aria-label="${shape} x${count} ${filled ? "מלא" : "ריק"}">${cellShapeMarkup(shape, count, filled)}</svg>`;
}

const CELL_SIZE = 72;
const CELL_GAP = 8;
const CELL_STRIDE = CELL_SIZE + CELL_GAP; // 80
const GRID_SIZE = CELL_SIZE * 3 + CELL_GAP * 2; // 232

/**
 * Composes the full 3x3 grid figure as a single SVG, so the runner can
 * render one real graphical figure instead of a text placeholder
 * (`ChoiceContent.figureSvg`, ASSESSMENT_DESIGN.md / FINTECH_REDESIGN_PLAN.md
 * §4 A1). Each visible cell reuses its 0-100 coordinate shape markup, scaled
 * down into its 72x72 slot; the missing cell (bottom-right) is drawn as a
 * dashed square with a "?" mark instead of left blank or described in text.
 */
function composeGridSvg(rows: ReadonlyArray<ReadonlyArray<string | null>>): string {
  const scale = CELL_SIZE / 100;
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = c * CELL_STRIDE;
      const y = r * CELL_STRIDE;
      const shapeMarkup = rows[r]?.[c] ?? null;
      if (shapeMarkup === null) {
        cells.push(
          `<g transform="translate(${x},${y})">` +
            `<rect x="0" y="0" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="none" stroke="#999999" stroke-width="2" stroke-dasharray="6 4"/>` +
            `<text x="${CELL_SIZE / 2}" y="${CELL_SIZE / 2 + 10}" text-anchor="middle" font-size="32" fill="#999999">?</text>` +
            `</g>`,
        );
      } else {
        cells.push(`<g transform="translate(${x},${y}) scale(${scale})">${shapeMarkup}</g>`);
      }
    }
  }
  return `<svg viewBox="0 0 ${GRID_SIZE} ${GRID_SIZE}" width="${GRID_SIZE}" height="${GRID_SIZE}" role="img" aria-label="רשת 3 על 3, התא הימני-תחתון חסר">${cells.join("")}</svg>`;
}

function fillFor(r: number, c: number): boolean {
  return (r + c) % 2 === 0;
}

export const template: ItemTemplate = {
  id: "reasoning.grid_pattern",
  version: 2,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const useFillRule = difficulty !== 1; // d1 drops the diagonal-fill rule entirely.
    const stateRulesExplicitly = difficulty !== 3; // d3 must be induced from the grid alone.

    const shapes = rng.shuffle(SHAPES);
    const fillOf = (r: number, c: number): boolean => (useFillRule ? fillFor(r, c) : true);

    // Build the visible 8 cells (row = shape, column = count) as raw shape
    // markup for composeGridSvg; the missing cell is `null` and drawn as a
    // dashed "?" square by composeGridSvg itself.
    const rows: (string | null)[][] = [];
    for (let r = 0; r < 3; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < 3; c++) {
        if (r === 2 && c === 2) {
          row.push(null); // missing cell
        } else {
          row.push(cellShapeMarkup(shapes[r] as Shape, COUNTS[c] as number, fillOf(r, c)));
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

    const figureSvg = composeGridSvg(rows);

    const ruleSentence = stateRulesExplicitly
      ? useFillRule
        ? "לפניכם רשת 3x3 עם שלושה כללים: כל שורה משתמשת בצורה קבועה, כל עמודה קובעת את מספר הצורות בתא, והמילוי (מלא/ריק) מתחלף לפי האלכסון. התא הימני-תחתון חסר."
        : "לפניכם רשת 3x3 עם שני כללים: כל שורה משתמשת בצורה קבועה, וכל עמודה קובעת את מספר הצורות בתא. התא הימני-תחתון חסר."
      : "לפניכם רשת 3x3 שבה 8 מתוך 9 התאים גלויים. הרשת בנויה לפי כללים קבועים (לא מפורטים) שניתן להסיק אותם ישירות מהתאים הגלויים. התא הימני-תחתון חסר.";

    const instruction = stateRulesExplicitly
      ? `בחרו את התא שמשלים את הרשת כך שכל ${useFillRule ? "שלושת" : "שני"} הכללים מתקיימים.`
      : "בחרו את התא שמשלים את הרשת בהתאם לתבנית שאפשר להסיק מהתאים הגלויים.";

    const prompt = `${ruleSentence}\n\n${instruction}`;

    const options = rng.shuffle([correctSvg, ...distractors]);
    const correctIndex = options.indexOf(correctSvg);

    return {
      content: { prompt, options, figureSvg, optionsFormat: "svg" },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
