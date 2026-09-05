import type { ButtonHTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 OptionButton spec — a shared primitive for
// the assessment runner's single/multi-choice and investigation options
// (item-views.tsx). NOTE: wiring this into item-views.tsx is P2 scope (the
// assessment runner redesign is a separate, later phase per the plan's
// scope note); this file ships the primitive now so P2 can adopt it
// without also inventing the component API.
//
// Full width, radius 12, 1px --line, bg --surface, padding 14 16, gap 12,
// text 16/26 --text. Letter badge at start: 28px circle, bg --ink-100,
// 14px 600 --ink-900, tabular-nums. Hover: bg --canvas. Selected: inset
// 2px --brand-600 ring (no layout shift), bg --brand-50, badge bg
// --brand-600 white. Multi-choice uses a square badge (radius 6) instead
// of a circle. size="sm" (investigation options): padding 10 12, 15/24.
export interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  badge: ReactNode;
  selected?: boolean;
  multi?: boolean;
  size?: "md" | "sm";
  children: ReactNode;
}

export function OptionButton({
  badge,
  selected = false,
  multi = false,
  size = "md",
  className = "",
  children,
  ...rest
}: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "focus-ring rtl-row w-full items-center gap-3 rounded-12 border border-line bg-surface text-start text-text hover:bg-canvas",
        size === "sm" ? "px-3 py-2.5 text-[15px] leading-6" : "px-4 py-3.5 text-base leading-[26px]",
        selected ? "bg-brand-50 shadow-[inset_0_0_0_2px_var(--brand-600)]" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={[
          "tnum flex h-7 w-7 shrink-0 items-center justify-center text-[14px] font-semibold",
          multi ? "rounded-md" : "rounded-full",
          selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-900",
        ].join(" ")}
      >
        {badge}
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}
