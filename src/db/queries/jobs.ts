import { withCandidate } from "@/db/postgres";

// CANDIDATE_FLOW.md §1.1 / §3: job rows read by the public landing + step-2
// pages. Runs in `candidate` context with no `application_id` (the `jobs`
// RLS policy only checks `app_ctx() = 'candidate' and is_active` —
// DATA_MODEL.md §6.3 — so this is safe pre-application).

export interface JobRow {
  id: string;
  slug: string;
  title_he: string;
  summary_he: string;
  description_html: string;
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
  is_active: boolean;
}

export async function getJobBySlug(slug: string): Promise<JobRow | null> {
  return withCandidate(undefined, async (tx) => {
    const rows = await tx<JobRow[]>`
      select id, slug, title_he, summary_he, description_html, hourly_rate_ils,
             hours_per_week, days_per_week, hours_per_day, engagement_type_he,
             location_he, hybrid_he, start_he, requires_rishon, confirmations_he,
             response_window_days, is_active
      from jobs
      where slug = ${slug} and is_active
      limit 1
    `;
    return rows[0] ?? null;
  });
}
