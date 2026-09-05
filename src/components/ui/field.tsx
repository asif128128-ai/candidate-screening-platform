import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

// FINTECH_REDESIGN_PLAN.md §1.5 Input/Select spec: height 48px, radius 10,
// 1px --line-strong, bg white, 16px text, padding 0 14px. Label above:
// 14/22 500 --text-2. Helper below: 13/20 --text-3. Focus: border
// --brand-600 + ring --brand-100 3px (via the shared .focus-ring class).
// Error: border --red-600, helper turns --red-600 with a leading "!" icon.

export function FieldLabel({ className = "", children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-[14px] font-medium leading-[22px] text-text-2 ${className}`} {...props}>
      {children}
    </label>
  );
}

export function HelperText({
  children,
  error = false,
  id,
}: {
  children: ReactNode;
  error?: boolean;
  id?: string;
}) {
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={`mt-1 text-[13px] leading-[20px] ${error ? "text-red-600" : "text-text-3"}`}
    >
      {error ? (
        <span aria-hidden="true" className="me-1 font-semibold">
          !
        </span>
      ) : null}
      {children}
    </p>
  );
}

const FIELD_BASE =
  "h-12 w-full rounded-10 border bg-white px-[14px] text-base leading-6 text-text placeholder:text-text-3 transition-[border-color,box-shadow] duration-150 ease-out focus:border-brand-600 focus:shadow-[0_0_0_3px_var(--brand-100)] focus:outline-none disabled:bg-canvas disabled:text-text-3";

export function Input({
  error = false,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`${FIELD_BASE} ${error ? "border-red-600" : "border-line-strong"} ${className}`}
      {...props}
    />
  );
}

// Custom chevron, positioned on the logical "end" side so it lands on the
// correct side in both RTL and LTR (FINTECH_REDESIGN_PLAN.md §1.5).
function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-text-3"
      fill="none"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Select({
  error = false,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <div className="relative">
      <select
        className={`${FIELD_BASE} appearance-none pe-10 ${error ? "border-red-600" : "border-line-strong"} ${className}`}
        {...props}
      >
        {children}
      </select>
      <SelectChevron />
    </div>
  );
}

// Convenience wrapper for the common "label + control + helper/error"
// stack used throughout the personal-details and privacy-request forms.
export function Field({
  label,
  htmlFor,
  helper,
  error,
  optional = false,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  helper?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const helperId = error ? `${htmlFor}-error` : helper ? `${htmlFor}-helper` : undefined;
  return (
    <div>
      <FieldLabel htmlFor={htmlFor}>
        {label}
        {optional ? <span className="font-normal text-text-3"> (לא חובה)</span> : null}
      </FieldLabel>
      <div className="mt-1">{children}</div>
      {error ? (
        <HelperText error id={helperId}>
          {error}
        </HelperText>
      ) : helper ? (
        <HelperText id={helperId}>{helper}</HelperText>
      ) : null}
    </div>
  );
}
