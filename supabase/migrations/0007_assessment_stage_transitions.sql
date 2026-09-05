-- 0007_assessment_stage_transitions.sql
-- Bug fix found while wiring the assessment runner against a real
-- Postgres: `application_stage_history` is `admin_only` RLS (DATA_MODEL.md
-- §6.3 / 0001_init.sql "admin_only on application_stage_history") — by
-- design, only admin-context transactions may write it. But two stage
-- transitions are system-driven, not admin-driven, and must happen from
-- *candidate*-context transactions (the assessment hot path never runs as
-- admin): applied -> assessment_started (session created) and
-- assessment_started -> assessment_completed (session finalized, whether
-- completed or abandoned). Attempting the raw UPDATE/INSERT from
-- `candidate` context fails with "new row violates row-level security
-- policy for table application_stage_history".
--
-- Same pattern as `finalize_session`/`cv_upsert`/`apply_outage_credit`
-- (0001_init.sql §7): a narrow `SECURITY DEFINER` function is the one path
-- allowed to make this specific, fully-determined write, callable from
-- `candidate` context, and — critically — executed inside the *caller's*
-- transaction, so it stays atomic with everything else `startAssessmentSession`
-- / the session-finalization path does (unlike calling out to a separate
-- `withSystem` transaction, which could commit independently of the
-- surrounding one).
create or replace function assessment_mark_stage(p_application_id uuid, p_to_stage application_stage, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from application_stage;
begin
  select stage into v_from from applications where id = p_application_id for update;
  if v_from is null or v_from = p_to_stage then
    return;
  end if;
  update applications set stage = p_to_stage, stage_changed_at = now() where id = p_application_id;
  insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
  values (p_application_id, v_from, p_to_stage, null, p_note);
end $$;
