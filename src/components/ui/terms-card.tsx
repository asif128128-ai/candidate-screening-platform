import { Term } from "@/components/term";
import { formatNumericHe } from "@/lib/format";

// FINTECH_REDESIGN_PLAN.md §1.5 InkCard / Terms card spec — replaces the
// two duplicated <section data-testid="terms-card"> blocks in
// jobs/[slug]/page.tsx and apply/[applicationId]/job/page.tsx. bg
// --ink-900, radius 16, padding 24, white text; a two-column key/value
// grid (single column under 480px); the rate is the hero figure in
// --mint-300. Keeps data-testid="terms-card" and aria-label — the e2e
// suite (candidate-flow.spec.ts) asserts on both, and on exactly 4 <bdi>
// elements (one per <Term>) inside this card.
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
          <span className="text-[32px] font-bold leading-[40px] text-mint-300 tnum">
            {formatNumericHe(job.hourly_rate_ils)} ₪
          </span>
        </Term>{" "}
        <span className="text-[14px] leading-5 text-ink-200">לשעה</span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 min-[480px]:grid-cols-2">
        <div>
          <dt className="text-[13px] leading-5 text-ink-200">היקף שבועי</dt>
          <dd className="mt-1 text-base font-semibold leading-6 text-white">
            <Term>{`כ-${formatNumericHe(job.hours_per_week)} שעות שבועיות`}</Term> ·{" "}
            <Term>{`כ-${formatNumericHe(job.days_per_week)} ימים בשבוע`}</Term>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] leading-5 text-ink-200">אורך יום עבודה</dt>
          <dd className="mt-1 text-base font-semibold leading-6 text-white">
            <Term>{`כ-${formatNumericHe(job.hours_per_day)} שעות ביום`}</Term>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] leading-5 text-ink-200">מיקום</dt>
          <dd className="mt-1 text-base font-semibold leading-6 text-white">
            {job.location_he}
            {job.hybrid_he ? ` · ${job.hybrid_he}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] leading-5 text-ink-200">סוג התקשרות</dt>
          <dd className="mt-1 text-base font-semibold leading-6 text-white">{job.engagement_type_he}</dd>
        </div>
        <div>
          <dt className="text-[13px] leading-5 text-ink-200">התחלה</dt>
          <dd className="mt-1 text-base font-semibold leading-6 text-white">{job.start_he}</dd>
        </div>
      </dl>
    </section>
  );
}
