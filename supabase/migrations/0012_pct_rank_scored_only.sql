-- 0012_pct_rank_scored_only.sql
--
-- Fable's final holistic review (see IMPLEMENTATION_STATE.md) found that
-- admin_application_rows.pct_rank (0001_init.sql §5) was computed with
-- `percent_rank() over (partition by a.job_id order by r.score_overall
-- nulls first)` across ALL applications in the job, including ones that
-- never started or finished the assessment (r.score_overall is null for
-- those). With a typical drop-off rate, never-tested applicants pile up at
-- the bottom of the ranking and inflate everyone else's percentile — the
-- admin's "מובילים" (top 10%) quick filter (ADMIN_UX.md) was therefore
-- showing roughly the top quarter of *completers*, not the top 10% of
-- test-takers, which is exactly the kind of fake precision the design
-- explicitly forbids (SCORING.md "no fake scientific precision").
--
-- Fix: compute percent_rank() only over applications that actually have a
-- score (a completed, scored assessment_results row). Applications with no
-- score get pct_rank = null (never shown as "top X%" — the UI already
-- treats null as "no rank" per its existing handling of other nullable
-- score columns), and the percentile among scored applications is now a
-- true statement about that population.

create or replace view admin_application_rows with (security_invoker = true) as
with scored as (
  select a.id as application_id,
         percent_rank() over (partition by a.job_id order by r.score_overall) as pct_rank
  from applications a
  join assessment_results r on r.application_id = a.id
  where r.score_overall is not null
)
select a.id as application_id, a.job_id, a.stage, a.stage_changed_at, a.created_at as applied_at,
       a.can_work_rishon, a.duplicate_phone_of is not null as dup_phone,
       c.id as candidate_id, c.first_name, c.last_name, c.email, c.phone_e164,
       c.institution, c.degree_program, c.study_year, c.academic_average, c.date_of_birth,
       c.linkedin_url is not null as has_linkedin, c.github_url is not null as has_github,
       cv.id is not null as has_cv,
       s.status as session_status, s.started_at as assessment_started_at, s.completed_at,
       r.score_overall, r.score_reasoning, r.score_independence, r.score_tech, r.score_speed,
       r.confidence, coalesce(r.integrity_risk_adjusted, r.integrity_risk) as integrity_risk,
       sc.pct_rank
from applications a
join candidates c on c.id = a.candidate_id
left join cv_files cv on cv.application_id = a.id
left join assessment_sessions s on s.application_id = a.id
left join assessment_results r on r.application_id = a.id
left join scored sc on sc.application_id = a.id;
