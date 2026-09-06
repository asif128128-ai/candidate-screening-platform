import type { ButtonHTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Button spec: height 48px (40px size="sm"),
// radius 12, padding 0 20px, 16/24 weight 600, full width on mobile forms.
// §R2.3.4 adds size="lg" (52px, px-7, 17/24 600) for every page-level
// primary CTA (landing, step-1 success, briefing "מתחילים", block-intro
// "להתחיל", practice continue).
export type ButtonVariant = "primary" | "secondary" | "ghost" | "onInk";
export type ButtonSize = "md" | "sm" | "lg";

// No padding/text-size utilities here — those are size-specific (below) so
// a conflicting pair like `px-5`/`px-7` never has to fight over CSS source
// order.
const BASE =
  "focus-ring rtl-row-inline items-center justify-center gap-2 rounded-12 font-semibold active:translate-y-px disabled:pointer-events-none";

const SIZE: Record<ButtonSize, string> = {
  sm: "h-10 px-5 text-base leading-6",
  md: "h-12 px-5 text-base leading-6",
  lg: "h-[52px] px-7 text-[17px] leading-6",
};

// FINTECH_REDESIGN_PLAN.md §R2.3.4 (overrides round 1's opacity-based
// disabled treatment): round 1's 45% opacity on the primary button read as
// a rendering glitch, not a disabled state. Primary now gets a solid
// disabled treatment (bg --line-strong, white text — 2.2:1, WCAG's
// exemption for disabled controls; the enabled state carries the real
// contrast). secondary/ghost/onInk keep an opacity-based disabled look.
// Hover on primary gets a visible lift + shadow; active resets the shadow
// (active:translate-y-px from BASE already cancels the hover lift).
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-[0_6px_16px_rgba(43,77,255,.28)] hover:-translate-y-px active:shadow-none disabled:bg-line-strong disabled:text-white disabled:shadow-none disabled:cursor-not-allowed",
  secondary:
    "border border-line-strong bg-surface text-ink-900 hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "bg-transparent text-text-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed",
  onInk: "bg-white text-ink-900 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed",
};

// FINTECH_REDESIGN_PLAN.md §R2.3.4 width rule: form submits are full width
// inside their card; page-level CTAs are auto width, min-w-[240px], aligned
// to the start side of the content column; everything is full width under
// 640px. Exported so every page-level CTA (landing, step-1 success, ...)
// applies the exact same rule instead of re-deriving it per page.
export const PAGE_CTA_WIDTH_CLASS = "w-full min-w-[240px] min-[640px]:w-auto";

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return [BASE, SIZE[size], VARIANT[variant], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

// A 16px spinner rendered at the start side during the pending state
// (§1.5 "Pending state: label swaps to the existing '…' copy and a 16px
// spinner at the start side").
export function ButtonSpinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  pending?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = true,
  pending = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || pending}
      {...rest}
    >
      {pending ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
}
