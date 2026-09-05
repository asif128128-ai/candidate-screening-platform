import type { HTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Callout spec: radius 12, padding 14 16,
// 14/22, icon at start. Replaces every ad-hoc bg-red-50/bg-amber-50/bg-blue-50
// paragraph in the candidate pages. Color is never the only carrier of
// meaning (§1.2) — each variant also gets a distinct icon.
export type CalloutVariant = "info" | "warning" | "error" | "success";

const CONTAINER: Record<CalloutVariant, string> = {
  info: "border-brand-100 bg-brand-50 text-text",
  warning: "border-amber-500/30 bg-amber-50 text-amber-800",
  error: "border-red-600/25 bg-red-50 text-red-600",
  success: "border-mint-600/25 bg-[#EAFBF5] text-mint-800",
};

const ICON_COLOR: Record<CalloutVariant, string> = {
  info: "text-brand-600",
  warning: "text-amber-800",
  error: "text-red-600",
  success: "text-mint-800",
};

function Icon({ variant }: { variant: CalloutVariant }) {
  const common = { viewBox: "0 0 20 20", className: `h-5 w-5 shrink-0 ${ICON_COLOR[variant]}`, "aria-hidden": true as const };
  if (variant === "success") {
    return (
      <svg {...common} fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 10.2l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg {...common} fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="13.7" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg {...common} fill="none">
        <path d="M10 3.2l8 14H2l8-14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 8.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="15" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.3" r="1" fill="currentColor" />
    </svg>
  );
}

export function Callout({
  variant = "info",
  className = "",
  children,
  ...rest
}: { variant?: CalloutVariant; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rtl-row items-start gap-2 rounded-12 border px-4 py-3.5 text-sm leading-[22px] ${CONTAINER[variant]} ${className}`}
      {...rest}
    >
      <Icon variant={variant} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
