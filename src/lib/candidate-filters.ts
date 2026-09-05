// Pure parse/serialize of the candidate list's URL-encoded filter state
// (ADMIN_UX.md §3: "URL-encoded filter state (shareable, back-button
// safe)"). Kept free of any DB/React import so it's directly unit-testable.

import type { ApplicationStage, IntegrityRisk } from "../db/queries/types";
import type { ScoreBand } from "./admin-format";

export type QuickFilter =
  | "top" // מובילים
  | "pending_review" // ממתינים לבדיקה
  | "overdue" // עבר מועד התשובה
  | "interview" // בראיון
  | "integrity_review" // לבדיקת אמינות
  | "not_finished" // לא סיימו
  | "all"; // הכול

export const QUICK_FILTERS: QuickFilter[] = [
  "top",
  "pending_review",
  "overdue",
  "interview",
  "integrity_review",
  "not_finished",
  "all",
];

/** Numeric/date columns the keyset pagination knows how to build a cursor
 * for (ADMIN_UX.md §3.6: "sort keys are denormalized in assessment_results").
 * Text-ish sorts (name, stage, institution) fall back to offset pagination
 * — see src/db/queries/candidates.ts for why that split is an acceptable
 * scope reduction at the stated data volumes. */
export type KeysetSortField =
  | "score_overall"
  | "score_reasoning"
  | "score_independence"
  | "score_tech"
  | "score_speed"
  | "pct_rank"
  | "applied_at";
export type OffsetSortField = "name" | "stage" | "institution";
export type SortField = KeysetSortField | OffsetSortField;
export type SortDir = "asc" | "desc";

export const KEYSET_SORT_FIELDS: KeysetSortField[] = [
  "score_overall",
  "score_reasoning",
  "score_independence",
  "score_tech",
  "score_speed",
  "pct_rank",
  "applied_at",
];
const OFFSET_SORT_FIELDS: OffsetSortField[] = ["name", "stage", "institution"];
const ALL_SORT_FIELDS: SortField[] = [...KEYSET_SORT_FIELDS, ...OFFSET_SORT_FIELDS];

export function isKeysetSortField(f: SortField): f is KeysetSortField {
  return (KEYSET_SORT_FIELDS as string[]).includes(f);
}

export interface CandidateFilters {
  jobId: string | null;
  quick: QuickFilter;
  stage: ApplicationStage[];
  integrity: IntegrityRisk[];
  overallBand: ScoreBand[];
  canWorkRishon: "yes" | "no" | "all";
  hasCv: boolean;
  hasGithub: boolean;
  hasLinkedin: boolean;
  studyYear: number[];
  institution: string[];
  appliedFrom: string | null;
  appliedTo: string | null;
  dupPhone: boolean;
  q: string | null;
  sort: SortField;
  dir: SortDir;
  cursor: string | null;
  offset: number;
}

export const DEFAULT_FILTERS: CandidateFilters = {
  jobId: null,
  quick: "all",
  stage: [],
  integrity: [],
  overallBand: [],
  canWorkRishon: "all",
  hasCv: false,
  hasGithub: false,
  hasLinkedin: false,
  studyYear: [],
  institution: [],
  appliedFrom: null,
  appliedTo: null,
  dupPhone: false,
  q: null,
  sort: "score_overall",
  dir: "desc",
  cursor: null,
  offset: 0,
};

const STAGES: ApplicationStage[] = [
  "applied",
  "assessment_started",
  "assessment_completed",
  "under_review",
  "interview",
  "rejected",
  "hired",
];
const RISKS: IntegrityRisk[] = ["low", "medium", "high"];
const BANDS: ScoreBand[] = ["low", "mid", "high"];

function csv(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

/** Parses `URLSearchParams` (or a plain record, as Next.js server components
 * receive `searchParams` as) into a validated `CandidateFilters`. Unknown
 * or invalid values are dropped rather than throwing — a tampered/stale URL
 * degrades to defaults for that one field, never a 500. */
export function parseCandidateFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): CandidateFilters {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const v = params[key];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };

  const quick = get("quick");
  const sort = get("sort");
  const dir = get("dir");
  const canWorkRishon = get("rishon");

  return {
    jobId: get("job"),
    quick: quick && (QUICK_FILTERS as string[]).includes(quick) ? (quick as QuickFilter) : "all",
    stage: csv(get("stage")).filter((s): s is ApplicationStage => (STAGES as string[]).includes(s)),
    integrity: csv(get("integrity")).filter((s): s is IntegrityRisk => (RISKS as string[]).includes(s)),
    overallBand: csv(get("band")).filter((s): s is ScoreBand => (BANDS as string[]).includes(s)),
    canWorkRishon: canWorkRishon === "yes" || canWorkRishon === "no" ? canWorkRishon : "all",
    hasCv: get("has_cv") === "1",
    hasGithub: get("has_github") === "1",
    hasLinkedin: get("has_linkedin") === "1",
    studyYear: csv(get("year"))
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
    institution: csv(get("institution")),
    appliedFrom: get("from"),
    appliedTo: get("to"),
    dupPhone: get("dup_phone") === "1",
    q: get("q")?.trim() || null,
    sort: sort && (ALL_SORT_FIELDS as string[]).includes(sort) ? (sort as SortField) : "score_overall",
    dir: dir === "asc" ? "asc" : "desc",
    cursor: get("cursor"),
    offset: Math.max(0, Number(get("offset")) || 0),
  };
}

/** Inverse of parseCandidateFilters — for building links (quick-filter
 * chips, sort headers, pagination) that preserve the rest of the state.
 * Fields left at their default are omitted so URLs stay short and stable. */
export function serializeCandidateFilters(f: Partial<CandidateFilters>): string {
  const merged: CandidateFilters = { ...DEFAULT_FILTERS, ...f };
  const params = new URLSearchParams();
  if (merged.jobId) params.set("job", merged.jobId);
  if (merged.quick !== "all") params.set("quick", merged.quick);
  if (merged.stage.length) params.set("stage", merged.stage.join(","));
  if (merged.integrity.length) params.set("integrity", merged.integrity.join(","));
  if (merged.overallBand.length) params.set("band", merged.overallBand.join(","));
  if (merged.canWorkRishon !== "all") params.set("rishon", merged.canWorkRishon);
  if (merged.hasCv) params.set("has_cv", "1");
  if (merged.hasGithub) params.set("has_github", "1");
  if (merged.hasLinkedin) params.set("has_linkedin", "1");
  if (merged.studyYear.length) params.set("year", merged.studyYear.join(","));
  if (merged.institution.length) params.set("institution", merged.institution.join(","));
  if (merged.appliedFrom) params.set("from", merged.appliedFrom);
  if (merged.appliedTo) params.set("to", merged.appliedTo);
  if (merged.dupPhone) params.set("dup_phone", "1");
  if (merged.q) params.set("q", merged.q);
  if (merged.sort !== "score_overall") params.set("sort", merged.sort);
  if (merged.dir !== "desc") params.set("dir", merged.dir);
  if (merged.cursor) params.set("cursor", merged.cursor);
  if (merged.offset) params.set("offset", String(merged.offset));
  return params.toString();
}

/** Quick-filter chip definitions -> the filter patch they apply when clicked
 * (ADMIN_UX.md §3.2). Applying one resets stage/sort where the filter
 * implies them, but preserves the job selection. */
export function quickFilterPatch(quick: QuickFilter): Partial<CandidateFilters> {
  switch (quick) {
    case "top":
      return { quick, sort: "score_overall", dir: "desc" };
    case "pending_review":
      return { quick, stage: ["assessment_completed"] };
    case "overdue":
      return { quick };
    case "interview":
      return { quick, stage: ["interview"] };
    case "integrity_review":
      return { quick, integrity: ["medium", "high"] };
    case "not_finished":
      return { quick, stage: ["applied", "assessment_started"] };
    case "all":
    default:
      return { quick: "all", stage: [], integrity: [], overallBand: [] };
  }
}
