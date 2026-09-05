import { formatScore } from "../../lib/admin-format";

/** ADMIN_UX.md §3.4: "four mini bars with numbers" for the pillar scores. */
export function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex min-w-[64px] flex-col gap-0.5" title={label}>
      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>{label}</span>
        <span className="ltr-inline">{formatScore(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
