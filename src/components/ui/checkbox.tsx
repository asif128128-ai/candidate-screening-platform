import type { InputHTMLAttributes, ReactNode } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Checkbox spec: custom 20px box, radius 6,
// 1.5px --line-strong; checked bg --brand-600 with a white check; label
// 15/24. The real <input type="checkbox"> stays in the DOM (opacity-0,
// stacked exactly over the decorative box) so it keeps native semantics,
// keyboard support and Playwright's `.check()` — only its default
// appearance is hidden, never its hit target or its data-testid.
export function Checkbox({
  label,
  className = "",
  ...props
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`rtl-row items-start gap-2 text-[15px] leading-6 text-text ${className}`}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
        <input type="checkbox" className="peer absolute inset-0 h-5 w-5 cursor-pointer opacity-0" {...props} />
        <span
          aria-hidden="true"
          className="pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] border-line-strong bg-white transition-colors duration-150 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand-600)]"
        >
          {/* Stroke is white on purpose: invisible against the unchecked
              white box, and revealed once the box turns --brand-600 — no
              separate opacity toggle needed. */}
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.2 11.5L13 4.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      <span>{label}</span>
    </label>
  );
}
