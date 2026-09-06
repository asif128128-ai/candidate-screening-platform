import type { HTMLAttributes } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Card spec: bg --surface, radius 16, 1px
// --line, shadow (boxShadow.card in tailwind.config.ts), padding 24
// (20 under 480px).
//
// §R2.3.3: "one primary surface per page" — `variant="flat"` drops the
// shadow (a plain bordered surface) for reading content (job description,
// briefing text, privacy request); `variant="raised"` (default, unchanged)
// is reserved for the surface the candidate acts on (a form, confirmations,
// the item pane, the done card). Never two raised cards stacked directly.
export type CardVariant = "raised" | "flat";

export function Card({
  variant = "raised",
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={`rounded-16 border border-line bg-surface p-5 min-[480px]:p-6 ${
        variant === "raised" ? "shadow-card" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
