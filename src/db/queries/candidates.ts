import type { TransactionSql } from "postgres";
import type { CandidateFilters, SortDir } from "../../lib/candidate-filters";
import { isKeysetSortField } from "../../lib/candidate-filters";
import { mapAdminApplicationRow, type AdminApplicationRow } from "./types";

// Candidate list query (ADMIN_UX.md §3): reads the `admin_application_rows`
// view (DATA_MODEL.md §4) — already implemented and already does the
// score/percentile/integrity join, per the task brief — so this file only
// adds filtering, sorting and pagination on top of it. It never invents its
// own join of candidates/applications/results.
//
// `sql.unsafe(text, params)` is used deliberately instead of the tagged
// `sql\`...\`` form: the WHERE clause and ORDER BY column are assembled
// dynamically (which filters are active, which column to sort by), and
// postgres.js's fragment composition doesn't compose as cleanly for that as
// building the text once and passing every *value* through the positional
// `$n` parameter array (still fully parameterized — the only string
// concatenation here is of column names drawn from the fixed whitelists in
// candidate-filters.ts, never of user-supplied text).

const SORT_COLUMN: Record<string, string> = {
  score_overall: "r.score_overall",
  score_reasoning: "r.score_reasoning",
  score_independence: "r.score_independence",
  score_tech: "r.score_tech",
  score_speed: "r.score_speed",
  pct_rank: "r.pct_rank",
  applied_at: "r.applied_at",
  name: "r.last_name, r.first_name",
  stage: "r.stage::text",
  institution: "r.institution, r.study_year",
};

export const PAGE_SIZE = 50;

export interface ListCandidatesResult {
  rows: AdminApplicationRow[];
  nextCursor: string | null;
  nextOffset: number | null;
}

function encodeCursor(value: unknown, applicationId: string): string {
  return Buffer.from(JSON.stringify([value, applicationId]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): [unknown, string] | null {
  try {
    const [value, applicationId] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return [value, applicationId];
  } catch {
    return null;
  }
}

export async function listCandidates(
  tx: TransactionSql,
  filters: CandidateFilters,
): Promise<ListCandidatesResult> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filters.jobId) where.push(`r.job_id = ${p(filters.jobId)}`);
  if (filters.stage.length) where.push(`r.stage = any(${p(filters.stage)}::application_stage[])`);
  if (filters.integrity.length) where.push(`r.integrity_risk = any(${p(filters.integrity)}::integrity_risk[])`);
  if (filters.overallBand.length) {
    const bandClauses = filters.overallBand.map((b) => {
      if (b === "high") return `r.score_overall >= 75`;
      if (b === "mid") return `r.score_overall >= 50 and r.score_overall < 75`;
      return `r.score_overall < 50`;
    });
    where.push(`(${bandClauses.join(" or ")})`);
  }
  if (filters.canWorkRishon !== "all") where.push(`r.can_work_rishon = ${p(filters.canWorkRishon === "yes")}`);
  if (filters.hasCv) where.push(`r.has_cv`);
  if (filters.hasGithub) where.push(`r.has_github`);
  if (filters.hasLinkedin) where.push(`r.has_linkedin`);
  if (filters.studyYear.length) where.push(`r.study_year = any(${p(filters.studyYear)}::smallint[])`);
  if (filters.institution.length) where.push(`r.institution = any(${p(filters.institution)}::text[])`);
  if (filters.appliedFrom) where.push(`r.applied_at >= ${p(filters.appliedFrom)}::date`);
  if (filters.appliedTo) where.push(`r.applied_at < (${p(filters.appliedTo)}::date + interval '1 day')`);
  if (filters.dupPhone) where.push(`r.dup_phone`);
  if (filters.q) {
    where.push(
      `(r.first_name || ' ' || r.last_name || ' ' || r.email || ' ' || r.phone_e164) ilike ${p("%" + filters.q + "%")}`,
    );
  }

  // Quick filters (ADMIN_UX.md §3.2)
  if (filters.quick === "top") {
    where.push(`r.confidence >= 0.6`);
    where.push(`r.pct_rank >= 0.9`);
  } else if (filters.quick === "overdue") {
    where.push(`r.applied_at + make_interval(days => j.response_window_days) < now()`);
    where.push(`r.stage not in ('rejected', 'hired')`);
  } else if (filters.quick === "integrity_review") {
    where.push(`r.integrity_risk in ('medium', 'high')`);
    where.push(
      `not exists (select 1 from admin_notes n where n.application_id = r.application_id and n.kind = 'integrity_reviewed')`,
    );
  }

  const sortColumn = SORT_COLUMN[filters.sort] ?? SORT_COLUMN.score_overall;
  const dir: SortDir = filters.dir;
  const nullsPos = dir === "desc" ? "nulls last" : "nulls first";

  let orderClause: string;
  let limitOffset = "";
  if (isKeysetSortField(filters.sort)) {
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      if (decoded) {
        const [cursorValue, cursorAppId] = decoded;
        if (cursorValue === null) {
          // NULLs sort last (desc) / first (asc); once in the NULL bucket,
          // only tie-break on application_id.
          where.push(`(${sortColumn} is null and r.application_id ${dir === "desc" ? ">" : "<"} ${p(cursorAppId)})`);
        } else {
          const op = dir === "desc" ? "<" : ">";
          where.push(
            `((${sortColumn}, r.application_id) ${op} (${p(cursorValue)}, ${p(cursorAppId)}) or ${sortColumn} is null)`,
          );
        }
      }
    }
    orderClause = `${sortColumn} ${dir} ${nullsPos}, r.application_id ${dir}`;
    limitOffset = `limit ${PAGE_SIZE + 1}`;
  } else {
    orderClause = `${sortColumn} ${dir}, r.application_id ${dir}`;
    limitOffset = `limit ${PAGE_SIZE + 1} offset ${filters.offset}`;
  }

  const whereClause = where.length ? `where ${where.join(" and ")}` : "";

  const query = `
    select r.application_id, r.job_id, r.stage, r.stage_changed_at, r.applied_at,
      r.can_work_rishon, r.dup_phone, r.candidate_id, r.first_name, r.last_name, r.email,
      r.phone_e164, r.institution, r.degree_program, r.study_year, r.academic_average,
      r.date_of_birth, r.has_linkedin, r.has_github, r.has_cv, r.session_status,
      r.assessment_started_at, r.completed_at, r.score_overall, r.score_reasoning,
      r.score_independence, r.score_tech, r.score_speed, r.confidence, r.integrity_risk,
      r.pct_rank
    from admin_application_rows r
    join jobs j on j.id = r.job_id
    ${whereClause}
    order by ${orderClause}
    ${limitOffset}
  `;

  const raw = (await tx.unsafe(query, params as never[])) as unknown as Array<
    Parameters<typeof mapAdminApplicationRow>[0]
  >;

  const hasMore = raw.length > PAGE_SIZE;
  const pageRows = hasMore ? raw.slice(0, PAGE_SIZE) : raw;
  const rows = pageRows.map(mapAdminApplicationRow);

  let nextCursor: string | null = null;
  let nextOffset: number | null = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1]!;
    if (isKeysetSortField(filters.sort)) {
      const sortKeyToRaw = {
        score_overall: last.score_overall,
        score_reasoning: last.score_reasoning,
        score_independence: last.score_independence,
        score_tech: last.score_tech,
        score_speed: last.score_speed,
        pct_rank: last.pct_rank,
        applied_at: last.applied_at,
      } as const;
      nextCursor = encodeCursor(sortKeyToRaw[filters.sort], last.application_id);
    } else {
      nextOffset = filters.offset + PAGE_SIZE;
    }
  }

  return { rows, nextCursor, nextOffset };
}

export interface HeaderCounts {
  applied: number;
  assessmentCompleted: number;
  pendingReview: number;
  interview: number;
  overdue: number;
  newLast24h: number;
}

/** ADMIN_UX.md §3.1: the five header numbers + "new in the last 24h", for one job. */
export async function getHeaderCounts(tx: TransactionSql, jobId: string): Promise<HeaderCounts> {
  const rows = await tx<
    { metric: string; count: string }[]
  >`
    select 'applied' as metric, count(*) as count from applications where job_id = ${jobId}
    union all
    select 'assessment_completed', count(*) from applications where job_id = ${jobId} and stage = 'assessment_completed'
    union all
    select 'pending_review', count(*) from applications where job_id = ${jobId} and stage = 'assessment_completed'
    union all
    select 'interview', count(*) from applications where job_id = ${jobId} and stage = 'interview'
    union all
    -- Only stages reached after the candidate actually finished the
    -- assessment: the reply-by-date promise (DECISIONS_LOG #3) is made on
    -- the done page, not at raw application time — see isOverdueForReply's
    -- comment in admin-format.ts for why 'applied'/'assessment_started'/
    -- 'interview' rows must not count here.
    select 'overdue', count(*)
      from applications a join jobs j on j.id = a.job_id
      where a.job_id = ${jobId}
        and a.stage in ('assessment_completed', 'under_review')
        and a.created_at + make_interval(days => j.response_window_days) < now()
    union all
    select 'new_24h', count(*) from applications where job_id = ${jobId} and created_at > now() - interval '24 hours'
  `;
  const byMetric = Object.fromEntries(rows.map((r) => [r.metric, Number(r.count)]));
  return {
    applied: byMetric.applied ?? 0,
    assessmentCompleted: byMetric.assessment_completed ?? 0,
    pendingReview: byMetric.pending_review ?? 0,
    interview: byMetric.interview ?? 0,
    overdue: byMetric.overdue ?? 0,
    newLast24h: byMetric.new_24h ?? 0,
  };
}

export interface JobOption {
  id: string;
  titleHe: string;
  isActive: boolean;
  createdAt: Date;
}

export async function listJobOptions(tx: TransactionSql): Promise<JobOption[]> {
  const rows = await tx<{ id: string; title_he: string; is_active: boolean; created_at: Date }[]>`
    select id, title_he, is_active, created_at from jobs order by is_active desc, created_at desc
  `;
  return rows.map((r) => ({ id: r.id, titleHe: r.title_he, isActive: r.is_active, createdAt: r.created_at }));
}

/** Default job for the list: the most recently created active job
 * (ADMIN_UX.md §2: "Default landing after login: מועמדים for the most
 * recently active job"). */
export async function getDefaultJobId(tx: TransactionSql): Promise<string | null> {
  const rows = await tx<{ id: string }[]>`
    select id from jobs where is_active order by created_at desc limit 1
  `;
  if (rows[0]) return rows[0].id;
  const any = await tx<{ id: string }[]>`select id from jobs order by created_at desc limit 1`;
  return any[0]?.id ?? null;
}

/** Distinct institutions for the filter panel's autocomplete list
 * (ADMIN_UX.md §3.3: "cached 10 min" — caching happens at the call site via
 * Next's `unstable_cache`/route segment revalidation, not here). */
export async function listDistinctInstitutions(tx: TransactionSql): Promise<string[]> {
  const rows = await tx<{ institution: string }[]>`
    select distinct institution from candidates order by institution limit 500
  `;
  return rows.map((r) => r.institution);
}
