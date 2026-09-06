// FINTECH_REDESIGN_PLAN.md §1.6 Stepper spec (sizes bumped by §R2.3.2):
// four steps — "פרטים · התפקיד · לפני המבחן · המבחן". Each: 10px dot + label
// 14/20. Done steps: dot --mint-600 with a white check inside (so "done" is
// not carried by color alone), label --text-2; current: dot --brand-600
// with 4px --brand-100 halo, label --ink-900 600; upcoming: dot
// --line-strong, label --text-3. Connectors 28px (w-7) 1px --line between
// dots. Under 640px it collapses to "שלב N מתוך 4".
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

// A done dot carries a white check, not just a color change — it renders a
// touch larger than the plain 10px dot (12px) so the glyph has room.
function DoneDot({ ringed }: { ringed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-mint-600 ${
        ringed ? "ring-2 ring-mint-600 ring-offset-2 ring-offset-surface" : ""
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none">
        <path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Stepper(props: StepperProps) {
  const { current, currentAlsoDone } = props;

  return (
    <nav aria-label="התקדמות בתהליך ההגשה">
      <ol className="hidden items-center gap-2.5 sm:flex">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const status = statusFor(step, props);
          const isCurrentAlsoDone = status === "current" && currentAlsoDone;
          return (
            <li key={label} className="rtl-row items-center gap-2.5">
              {i > 0 ? <span aria-hidden="true" className="h-px w-7 bg-line" /> : null}
              {status === "done" ? (
                <DoneDot />
              ) : isCurrentAlsoDone ? (
                <DoneDot ringed />
              ) : (
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
              )}
              <span className={`text-[14px] leading-5 ${LABEL[status]}`}>{label}</span>
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
