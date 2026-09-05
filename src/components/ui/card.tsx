import type { HTMLAttributes } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Card spec: bg --surface, radius 16, 1px
// --line, shadow (boxShadow.card in tailwind.config.ts), padding 24
// (20 under 480px).
export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-16 border border-line bg-surface p-5 shadow-card min-[480px]:p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
