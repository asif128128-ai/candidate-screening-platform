import { Term } from "@/components/term";
import { formatNumericHe } from "@/lib/format";

// FINTECH_REDESIGN_PLAN.md §1.5 InkCard / Terms card spec — replaces the
// two duplicated <section data-testid="terms-card"> blocks in
// jobs/[slug]/page.tsx and apply/[applicationId]/job/page.tsx. bg
// --ink-900, radius 16, padding 24, white text; the rate is the hero
// figure in --mint-300. Keeps data-testid="terms-card" and aria-label —
// the e2e suite (candidate-flow.spec.ts) asserts on both, and on exactly 4
// <bdi> elements (one per <Term>) inside this card.
//
// §R2.2 landing item 3: the round-1 2-column grid left "התחלה" orphaned
// alone on its own row, and the rate was under-scaled for a 720px card.
// Now: rate bumped to 40/48; a rule line separates it from a THREE-column
// grid at >=640px; DOM order is מיקום (col-span-2, so it never orphans
// against a 3-col track) · התחלה / היקף שבועי · אורך יום · סוג התקשרות —
// five cells exactly fill a 2x3 grid. Still exactly four <Term>s.
export interface TermsCardJob {
  hourly_rate_ils: string | number | null;
  hours_per_week: string | number | null;
  days_per_week: string | number | null;
  hours_per_day: string | number | null;
  location_he: string;
  hybrid_he: string | null;
  engagement_type_he: string;
  start_he: string;
}

export function TermsCard({ job }: { job: TermsCardJob }) {
  return (
    <section
      className="rounded-16 bg-ink-900 p-5 text-white min-[480px]:p-6"
      aria-label="תנאי ההתקשרות"
      data-testid="terms-card"
    >
      <h2 className="text-[13px] font-semibold leading-5 text-ink-200">תנאי ההתקשרות</h2>

      <div className="rtl-row mt-4 flex-wrap items-baseline gap-x-2">
        <Term>
          <span className="text-[40px] font-bold leading-[48px] text-mint-300 tnum">
            {formatNumericHe(job.hourly_rate_ils)} ₪
          </span>
        </Term>{" "}
        <span className="text-[15px] leading-6 text-ink-200">לשעה</span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-ink-800 pt-5 min-[480px]:grid-cols-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <dt className="text-[12px] font-semibold leading-4 text-ink-200">מיקום</dt>
          <dd className="mt-1 text-[15px] font-semibold leading-6 text-white">
            {job.location_he}
            {job.hybrid_he ? ` · ${job.hybrid_he}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold leading-4 text-ink-200">התחלה</dt>
          <dd className="mt-1 text-[15px] font-semibold leading-6 text-white">{job.start_he}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold leading-4 text-ink-200">היקף שבועי</dt>
          <dd className="mt-1 text-[15px] font-semibold leading-6 text-white">
            <Term>{`כ-${formatNumericHe(job.hours_per_week)} שעות שבועיות`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.days_per_week)} ימים בשבוע`}</Term>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold leading-4 text-ink-200">אורך יום עבודה</dt>
          <dd className="mt-1 text-[15px] font-semibold leading-6 text-white">
            <Term>{`כ-${formatNumericHe(job.hours_per_day)} שעות ביום`}</Term>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold leading-4 text-ink-200">סוג התקשרות</dt>
          <dd className="mt-1 text-[15px] font-semibold leading-6 text-white">{job.engagement_type_he}</dd>
        </div>
      </dl>
    </section>
  );
}
