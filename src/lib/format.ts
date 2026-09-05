// ARCHITECTURE.md §9: "Numbers use Intl.NumberFormat('he-IL')". `jobs`'s
// numeric columns (postgres.js returns `numeric` as a string, e.g. "85.00"
// or "18.0") need trimming before display so "85.00 ₪" doesn't render with
// spurious trailing zeros.
const heNumberFormat = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });

export function formatNumericHe(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "";
  return heNumberFormat.format(n);
}
