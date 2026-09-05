import type { HTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Chip spec: height 28, radius 999, 13/20 600,
// bg --ink-100, text --ink-900. On ink: bg --ink-800, text white.
export function Chip({
  onInk = false,
  className = "",
  children,
  ...rest
}: { onInk?: boolean; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold leading-5 tnum ${
        onInk ? "bg-ink-800 text-white" : "bg-ink-100 text-ink-900"
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
