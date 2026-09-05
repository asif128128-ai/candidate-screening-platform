import type { TransactionSql } from "postgres";

// Jobs management (ADMIN_UX.md §5). Straightforward CRUD over `jobs`
// (DATA_MODEL.md §3.2) plus the assessment-config picklist and per-job
// candidate counts by stage.

export interface JobListItem {
  id: string;
  slug: string;
  titleHe: string;
  isActive: boolean;
  configName: string;
  createdAt: Date;
  counts: { applied: number; completed: number; interview: number; hired: number; total: number };
}

export async function listJobs(tx: TransactionSql): Promise<JobListItem[]> {
  const rows = await tx<
    Array<{
      id: string;
      slug: string;
      title_he: string;
      is_active: boolean;
      config_name: string;
      created_at: Date;
      applied: string;
      completed: string;
      interview: string;
      hired: string;
      total: string;
    }>
  >`
    select j.id, j.slug, j.title_he, j.is_active, ac.name_he as config_name, j.created_at,
      count(a.id) filter (where a.stage = 'applied') as applied,
      count(a.id) filter (where a.stage = 'assessment_completed') as completed,
      count(a.id) filter (where a.stage = 'interview') as interview,
      count(a.id) filter (where a.stage = 'hired') as hired,
      count(a.id) as total
    from jobs j
    join assessment_configs ac on ac.id = j.assessment_config_id
    left join applications a on a.job_id = j.id
    group by j.id, ac.name_he
    order by j.is_active desc, j.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    titleHe: r.title_he,
    isActive: r.is_active,
    configName: r.config_name,
    createdAt: r.created_at,
    counts: {
      applied: Number(r.applied),
      completed: Number(r.completed),
      interview: Number(r.interview),
      hired: Number(r.hired),
      total: Number(r.total),
    },
  }));
}

export interface JobDetail {
  id: string;
  slug: string;
  titleHe: string;
  titleEn: string | null;
  summaryHe: string;
  descriptionHe: string;
  hourlyRateIls: number | null;
  hoursPerWeek: number | null;
  daysPerWeek: number | null;
  hoursPerDay: number | null;
  engagementTypeHe: string;
  locationHe: string;
  hybridHe: string | null;
  startHe: string;
  requiresRishon: boolean;
  confirmationsHe: string[];
  responseWindowDays: number;
  sendRejectionEmail: boolean;
  isActive: boolean;
  assessmentConfigId: string;
  applicationCount: number;
}

export async function getJob(tx: TransactionSql, id: string): Promise<JobDetail | null> {
  const rows = await tx<
    Array<{
      id: string;
      slug: string;
      title_he: string;
      title_en: string | null;
      summary_he: string;
      description_he: string;
      hourly_rate_ils: string | null;
      hours_per_week: string | null;
      days_per_week: string | null;
      hours_per_day: string | null;
      engagement_type_he: string;
      location_he: string;
      hybrid_he: string | null;
      start_he: string;
      requires_rishon: boolean;
      confirmations_he: string[];
      response_window_days: number;
      send_rejection_email: boolean;
      is_active: boolean;
      assessment_config_id: string;
      application_count: string;
    }>
  >`
    select j.*, (select count(*) from applications a where a.job_id = j.id) as application_count
    from jobs j where j.id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    titleHe: r.title_he,
    titleEn: r.title_en,
    summaryHe: r.summary_he,
    descriptionHe: r.description_he,
    hourlyRateIls: r.hourly_rate_ils === null ? null : Number(r.hourly_rate_ils),
    hoursPerWeek: r.hours_per_week === null ? null : Number(r.hours_per_week),
    daysPerWeek: r.days_per_week === null ? null : Number(r.days_per_week),
    hoursPerDay: r.hours_per_day === null ? null : Number(r.hours_per_day),
    engagementTypeHe: r.engagement_type_he,
    locationHe: r.location_he,
    hybridHe: r.hybrid_he,
    startHe: r.start_he,
    requiresRishon: r.requires_rishon,
    confirmationsHe: r.confirmations_he,
    responseWindowDays: r.response_window_days,
    sendRejectionEmail: r.send_rejection_email,
    isActive: r.is_active,
    assessmentConfigId: r.assessment_config_id,
    applicationCount: Number(r.application_count),
  };
}

export interface AssessmentConfigOption {
  id: string;
  key: string;
  nameHe: string;
}

export async function listAssessmentConfigs(tx: TransactionSql): Promise<AssessmentConfigOption[]> {
  const rows = await tx<Array<{ id: string; key: string; name_he: string }>>`
    select id, key, name_he from assessment_configs order by created_at
  `;
  return rows.map((r) => ({ id: r.id, key: r.key, nameHe: r.name_he }));
}

/** Very small, dependency-free markdown-to-HTML rendering for
 * `description_html` (DATA_MODEL.md §3.2: "rendered from description_he on
 * save (no runtime markdown lib)", ARCHITECTURE.md §7). Supports the
 * handful of constructs the job description actually needs: paragraphs,
 * `**bold**`, and `- ` bullet lists. Deliberately not a general Markdown
 * engine — the candidate-facing renderer must stay dependency-free too. */
export function renderJobDescriptionHtml(markdown: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = markdown.trim().split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));
      const inline = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (isList) {
        return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${inline(lines.join(" "))}</p>`;
    })
    .join("\n");
  return html;
}

export interface JobInput {
  slug: string;
  titleHe: string;
  titleEn: string | null;
  summaryHe: string;
  descriptionHe: string;
  hourlyRateIls: number | null;
  hoursPerWeek: number | null;
  daysPerWeek: number | null;
  hoursPerDay: number | null;
  engagementTypeHe: string;
  locationHe: string;
  hybridHe: string | null;
  startHe: string;
  requiresRishon: boolean;
  confirmationsHe: string[];
  responseWindowDays: number;
  sendRejectionEmail: boolean;
  isActive: boolean;
  assessmentConfigId: string;
}

export async function createJob(tx: TransactionSql, input: JobInput, adminId: string): Promise<string> {
  const html = renderJobDescriptionHtml(input.descriptionHe);
  const [row] = await tx<{ id: string }[]>`
    insert into jobs (
      slug, title_he, title_en, summary_he, description_he, description_html,
      hourly_rate_ils, hours_per_week, days_per_week, hours_per_day,
      engagement_type_he, location_he, hybrid_he, start_he, requires_rishon,
      confirmations_he, response_window_days, send_rejection_email, is_active,
      assessment_config_id, created_by
    ) values (
      ${input.slug}, ${input.titleHe}, ${input.titleEn}, ${input.summaryHe}, ${input.descriptionHe}, ${html},
      ${input.hourlyRateIls}, ${input.hoursPerWeek}, ${input.daysPerWeek}, ${input.hoursPerDay},
      ${input.engagementTypeHe}, ${input.locationHe}, ${input.hybridHe}, ${input.startHe}, ${input.requiresRishon},
      ${tx.json(input.confirmationsHe)}, ${input.responseWindowDays}, ${input.sendRejectionEmail}, ${input.isActive},
      ${input.assessmentConfigId}::uuid, ${adminId}
    )
    returning id
  `;
  if (!row) throw new Error("יצירת המשרה נכשלה");
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id, meta)
    values (${adminId}, 'job.create', 'job', ${row.id}, ${tx.json({ slug: input.slug })})
  `;
  return row.id;
}

export async function updateJob(tx: TransactionSql, id: string, input: JobInput, adminId: string): Promise<void> {
  const html = renderJobDescriptionHtml(input.descriptionHe);
  await tx`
    update jobs set
      slug = ${input.slug}, title_he = ${input.titleHe}, title_en = ${input.titleEn},
      summary_he = ${input.summaryHe}, description_he = ${input.descriptionHe}, description_html = ${html},
      hourly_rate_ils = ${input.hourlyRateIls}, hours_per_week = ${input.hoursPerWeek},
      days_per_week = ${input.daysPerWeek}, hours_per_day = ${input.hoursPerDay},
      engagement_type_he = ${input.engagementTypeHe}, location_he = ${input.locationHe},
      hybrid_he = ${input.hybridHe}, start_he = ${input.startHe}, requires_rishon = ${input.requiresRishon},
      confirmations_he = ${tx.json(input.confirmationsHe)}, response_window_days = ${input.responseWindowDays},
      send_rejection_email = ${input.sendRejectionEmail}, is_active = ${input.isActive},
      assessment_config_id = ${input.assessmentConfigId}::uuid, updated_at = now()
    where id = ${id}
  `;
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id, meta)
    values (${adminId}, 'job.update', 'job', ${id}, ${tx.json({ slug: input.slug })})
  `;
}

export async function setJobActive(tx: TransactionSql, id: string, isActive: boolean, adminId: string): Promise<void> {
  await tx`update jobs set is_active = ${isActive}, updated_at = now() where id = ${id}`;
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id, meta)
    values (${adminId}, 'job.update', 'job', ${id}, ${tx.json({ is_active: isActive })})
  `;
}

/** Only allowed when the job has zero applications (ADMIN_UX.md §5). */
export async function deleteJobIfEmpty(tx: TransactionSql, id: string, adminId: string): Promise<boolean> {
  const [row] = await tx<{ count: string }[]>`select count(*) from applications where job_id = ${id}`;
  if (Number(row?.count ?? 0) > 0) return false;
  await tx`delete from jobs where id = ${id}`;
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id)
    values (${adminId}, 'job.delete', 'job', ${id})
  `;
  return true;
}
