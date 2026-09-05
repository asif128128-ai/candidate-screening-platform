// FINTECH_REDESIGN_PLAN.md §1.6 Stepper spec: four steps — "פרטים · התפקיד ·
// לפני המבחן · המבחן". Each: 8px dot + label 13/20. Done steps: dot
// --mint-600, label --text-2; current: dot --brand-600 with 4px --brand-100
// halo, label --ink-900 600; upcoming: dot --line-strong, label --text-3.
// Connectors 1px --line between dots. Under 640px it collapses to
// "שלב N מתוך 4".
const STEP_LABELS = ["פרטים", "התפקיד", "לפני המבחן", "המבחן"] as const;

export type StepperCurrent = 1 | 2 | 3 | 4;

export interface StepperProps {
  /** Which step is current (1-4). Ignored visually (all steps render as
   * done) when `allDone` is set — used on the done page. */
  current: StepperCurrent;
  /** Done page: all four steps render in the "done" state regardless of
   * `current`. */
  allDone?: boolean;
  /** Step-1 success panel (§1.6): current stays 1, but that step also gets
   * a "done" look layered onto the current halo — the form is done, the
   * candidate hasn't navigated yet. */
  currentAlsoDone?: boolean;
}

type StepStatus = "done" | "current" | "upcoming";

function statusFor(step: number, { current, allDone }: StepperProps): StepStatus {
  if (allDone) return "done";
  if (step < current) return "done";
  if (step === current) return "current";
  return "upcoming";
}

const DOT: Record<StepStatus, string> = {
  done: "bg-mint-600",
  current: "bg-brand-600 shadow-[0_0_0_4px_var(--brand-100)]",
  upcoming: "bg-line-strong",
};

const LABEL: Record<StepStatus, string> = {
  done: "text-text-2",
  current: "font-semibold text-ink-900",
  upcoming: "text-text-3",
};

export function Stepper(props: StepperProps) {
  const { current, currentAlsoDone } = props;

  return (
    <nav aria-label="התקדמות בתהליך ההגשה">
      <ol className="hidden items-center gap-2 sm:flex">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const status = statusFor(step, props);
          const dotClass = status === "current" && currentAlsoDone ? `${DOT.current} ring-2 ring-mint-600` : DOT[status];
          return (
            <li key={label} className="rtl-row items-center gap-2">
              {i > 0 ? <span aria-hidden="true" className="h-px w-4 bg-line" /> : null}
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotClass}`} />
              <span className={`text-[13px] leading-5 ${LABEL[status]}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] leading-5 text-text-3 tnum sm:hidden">
        שלב <span className="tnum">{props.allDone ? 4 : current}</span> מתוך <span className="tnum">4</span>
      </p>
    </nav>
  );
}
