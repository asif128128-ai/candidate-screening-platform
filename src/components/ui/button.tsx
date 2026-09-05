import type { ButtonHTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Button spec: height 48px (40px size="sm"),
// radius 12, padding 0 20px, 16/24 weight 600, full width on mobile forms.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "onInk";
export type ButtonSize = "md" | "sm";

const BASE =
  "focus-ring rtl-row-inline items-center justify-center gap-2 rounded-12 px-5 text-base font-semibold leading-6 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const SIZE: Record<ButtonSize, string> = {
  md: "h-12",
  sm: "h-10",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-line-strong bg-surface text-ink-900 hover:bg-canvas",
  ghost: "bg-transparent text-text-2 hover:underline",
  onInk: "bg-white text-ink-900 hover:bg-ink-100",
};

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
