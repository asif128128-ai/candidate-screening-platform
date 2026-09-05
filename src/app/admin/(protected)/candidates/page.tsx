import Link from "next/link";
import { withCurrentAdmin } from "../../../../lib/current-admin";
import {
  listCandidates,
  getHeaderCounts,
  listJobOptions,
  getDefaultJobId,
  listDistinctInstitutions,
} from "../../../../db/queries/candidates";
import {
  parseCandidateFilters,
  serializeCandidateFilters,
  quickFilterPatch,
  QUICK_FILTERS,
  type QuickFilter,
  type SortField,
} from "../../../../lib/candidate-filters";
import { STAGE_ORDER, STAGE_LABELS_HE, INTEGRITY_LABELS_HE, formatNumber } from "../../../../lib/admin-format";
import { CandidateTableClient } from "./candidate-table-client";

const QUICK_LABELS: Record<QuickFilter, string> = {
  top: "מובילים",
  pending_review: "ממתינים לבדיקה",
  overdue: "עבר מועד התשובה",
  interview: "בראיון",
  integrity_review: "לבדיקת אמינות",
  not_finished: "לא סיימו",
  all: "הכול",
};

const SORTABLE_COLUMNS: Array<{ field: SortField; label: string }> = [
  { field: "name", label: "שם" },
  { field: "score_overall", label: "ציון כולל" },
  { field: "pct_rank", label: "אחוזון" },
  { field: "stage", label: "שלב" },
  { field: "institution", label: "מוסד · שנה" },
  { field: "applied_at", label: "הוגש" },
];

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let filters = parseCandidateFilters(sp);

  const { rows, nextCursor, nextOffset, headerCounts, jobOptions, institutions, resolvedJobId } = await withCurrentAdmin(
    async (tx) => {
      const jobId = filters.jobId ?? (await getDefaultJobId(tx));
      const effectiveFilters = { ...filters, jobId };
      const [listResult, counts, jobs, insts] = await Promise.all([
        listCandidates(tx, effectiveFilters),
        jobId ? getHeaderCounts(tx, jobId) : null,
        listJobOptions(tx),
        listDistinctInstitutions(tx),
      ]);
      return {
        rows: listResult.rows,
        nextCursor: listResult.nextCursor,
        nextOffset: listResult.nextOffset,
        headerCounts: counts,
        jobOptions: jobs,
        institutions: insts,
        resolvedJobId: jobId,
      };
    },
  );
  filters = { ...filters, jobId: resolvedJobId };

  const baseHref = (patch: Parameters<typeof serializeCandidateFilters>[0]) =>
    "/admin/candidates?" + serializeCandidateFilters({ ...filters, ...patch });

  return (
    <div dir="rtl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">מועמדים</h1>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label className="text-neutral-500">משרה:</label>
          <select
            name="job"
            defaultValue={filters.jobId ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1"
          >
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.titleHe} {j.isActive ? "" : "(לא פעילה)"}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-50">
            החלף
          </button>
        </form>
      </div>

      {headerCounts && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <HeaderStat label="הגישו" value={headerCounts.applied} />
          <HeaderStat label="סיימו מבחן" value={headerCounts.assessmentCompleted} />
          <HeaderStat label="ממתינים לבדיקה" value={headerCounts.pendingReview} />
          <HeaderStat label="בראיון" value={headerCounts.interview} />
          <HeaderStat label="עבר מועד התשובה" value={headerCounts.overdue} warn={headerCounts.overdue > 0} />
          <HeaderStat label="חדשים ב-24 השעות" value={headerCounts.newLast24h} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => (
          <Link
            key={q}
            href={baseHref(quickFilterPatch(q))}
            className={`rounded-full border px-3 py-1 text-sm ${
              filters.quick === q ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {QUICK_LABELS[q]}
          </Link>
        ))}
      </div>

      <details className="mb-4 rounded-md border border-neutral-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-neutral-700">
          סינון מתקדם
        </summary>
        <form method="get" className="grid grid-cols-2 gap-4 border-t border-neutral-200 p-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <input type="hidden" name="job" value={filters.jobId ?? ""} />
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">שלב</legend>
            {STAGE_ORDER.map((s) => (
              <label key={s} className="flex items-center gap-1.5">
                <input type="checkbox" name="stage" value={s} defaultChecked={filters.stage.includes(s)} />
                {STAGE_LABELS_HE[s]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">אמינות</legend>
            {(["low", "medium", "high"] as const).map((r) => (
              <label key={r} className="flex items-center gap-1.5">
                <input type="checkbox" name="integrity" value={r} defaultChecked={filters.integrity.includes(r)} />
                {INTEGRITY_LABELS_HE[r]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">ציון כולל</legend>
            {(["high", "mid", "low"] as const).map((b) => (
              <label key={b} className="flex items-center gap-1.5">
                <input type="checkbox" name="band" value={b} defaultChecked={filters.overallBand.includes(b)} />
                {b === "high" ? "גבוה (75+)" : b === "mid" ? "בינוני (50–74)" : "נמוך (מתחת ל-50)"}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">זמינות בראשון</legend>
            {(["all", "yes", "no"] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="rishon" value={v} defaultChecked={filters.canWorkRishon === v} />
                {v === "all" ? "הכול" : v === "yes" ? "כן" : "לא"}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">קבצים</legend>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="has_cv" value="1" defaultChecked={filters.hasCv} /> קורות חיים
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="has_github" value="1" defaultChecked={filters.hasGithub} /> GitHub
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="has_linkedin" value="1" defaultChecked={filters.hasLinkedin} /> LinkedIn
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="dup_phone" value="1" defaultChecked={filters.dupPhone} /> טלפון כפול
            </label>
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium text-neutral-600">שנת לימודים</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((y) => (
                <label key={y} className="flex items-center gap-1">
                  <input type="checkbox" name="year" value={y} defaultChecked={filters.studyYear.includes(y)} />
                  {y}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-neutral-600">מוסד</span>
            <select name="institution" multiple defaultValue={filters.institution} className="h-24 rounded-md border border-neutral-300 p-1">
              {institutions.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-neutral-600">הוגש מתאריך</span>
            <input type="date" name="from" defaultValue={filters.appliedFrom ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-neutral-600">הוגש עד תאריך</span>
            <input type="date" name="to" defaultValue={filters.appliedTo ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-medium text-neutral-600">חיפוש חופשי (שם, אימייל, טלפון)</span>
            <input type="text" name="q" defaultValue={filters.q ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <p className="col-span-full text-xs text-neutral-400">
            הממוצע האקדמי מוצג בכרטיס המועמד אך אינו זמין כסינון או מיון — אינו פוסל מועמדות.
          </p>
          <div className="col-span-full flex gap-2">
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-1.5 text-white hover:bg-neutral-700">
              החל סינון
            </button>
            <Link href={baseHref({ ...quickFilterPatch("all"), q: null, appliedFrom: null, appliedTo: null, institution: [], studyYear: [], canWorkRishon: "all", hasCv: false, hasGithub: false, hasLinkedin: false, dupPhone: false })} className="rounded-md border border-neutral-300 px-4 py-1.5 hover:bg-neutral-50">
              נקה הכול
            </Link>
          </div>
        </form>
      </details>

      <div className="mb-2 flex gap-4 border-b border-neutral-200 pb-2 text-xs font-medium text-neutral-500">
        {SORTABLE_COLUMNS.map(({ field, label }) => {
          const active = filters.sort === field;
          const nextDir = active && filters.dir === "desc" ? "asc" : "desc";
          return (
            <Link key={field} href={baseHref({ sort: field, dir: nextDir, cursor: null, offset: 0 })} className={active ? "text-neutral-900 underline" : "hover:text-neutral-700"}>
              {label} {active ? (filters.dir === "desc" ? "▾" : "▴") : ""}
            </Link>
          );
        })}
      </div>

      <CandidateTableClient rows={rows} filters={filters} />

      <div className="mt-4 flex justify-center gap-4 text-sm">
        {filters.offset > 0 && (
          <Link href={baseHref({ offset: Math.max(0, filters.offset - 50) })} className="underline">
            הקודם
          </Link>
        )}
        {nextCursor && (
          <Link href={baseHref({ cursor: nextCursor })} className="underline">
            הבא
          </Link>
        )}
        {nextOffset !== null && (
          <Link href={baseHref({ offset: nextOffset })} className="underline">
            הבא
          </Link>
        )}
      </div>
    </div>
  );
}

function HeaderStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${warn ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-amber-900" : "text-neutral-900"}`}>{formatNumber(value)}</div>
    </div>
  );
}
