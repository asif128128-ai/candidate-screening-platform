import type { ReactNode } from "react";

// ADMIN_UX.md §9: "Colors carry meaning consistently: score bands use one
// blue-to-green ramp; integrity uses a separate grey/amber/red set; stages
// use neutral pills. Never mix the two scales." Three fixed variant sets
// below enforce that at the component level rather than by convention.

const SCORE_BAND_CLASSES: Record<"low" | "mid" | "high" | "unknown", string> = {
  high: "bg-emerald-100 text-emerald-900",
  mid: "bg-sky-100 text-sky-900",
  low: "bg-blue-50 text-blue-900",
  unknown: "bg-neutral-100 text-neutral-500",
};

const INTEGRITY_CLASSES: Record<"low" | "medium" | "high", string> = {
  low: "bg-neutral-100 text-neutral-600",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-900",
};

const STAGE_CLASSES = "bg-neutral-100 text-neutral-700";

export function ScoreBandPill({ band, children }: { band: "low" | "mid" | "high" | "unknown"; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_BAND_CLASSES[band]}`}>
      {children}
    </span>
  );
}

export function IntegrityPill({ risk, children }: { risk: "low" | "medium" | "high"; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INTEGRITY_CLASSES[risk]}`}>
      {children}
    </span>
  );
}

export function StagePill({ children }: { children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_CLASSES}`}>
      {children}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: ReactNode }) {
  const cls = tone === "warning" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-600";
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
