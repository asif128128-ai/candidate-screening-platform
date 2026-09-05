-- 0001_init.sql
-- Full schema per docs/DATA_MODEL.md (as amended by docs/DECISIONS_LOG.md).
-- Postgres 15 (Supabase). Schema `public` unless noted. Forward-only,
-- idempotent where cheap (DEPLOYMENT.md §5).
--
-- NOTE: this migration has not been executed against a live Postgres
-- instance in this environment (no Supabase project available to the
-- implementation agent). Run `supabase db push` against a real project and
-- `supabase test db` (pgTAP) before first deploy. See
-- IMPLEMENTATION_NOTES.md.

-- =====================================================================
-- 0. Extensions (DEPLOYMENT.md §5: pgcrypto, citext, pg_trgm; no pg_cron/pg_net)
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- =====================================================================
-- 1. Roles (DATA_MODEL.md §6.1) — least-privilege role for the app server.
-- Password is set post-migration via `pnpm db:set-app-password`
-- (scripts/set-app-password.ts) so it never lives in a migration file.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login password 'changeme_set_by_setup_script' nobypassrls noinherit;
  end if;
end
$$;

grant usage on schema public to app_user;

-- =====================================================================
-- 2. Enums (DATA_MODEL.md §2)
-- =====================================================================
do $$ begin
  create type application_stage as enum (
    'applied',              -- הוגשה מועמדות
    'assessment_started',   -- המבחן התחיל
    'assessment_completed', -- המבחן הושלם
    'under_review',         -- בבדיקה
    'interview',            -- ראיון
    'rejected',             -- נדחה
    'hired'                 -- התקבל/ה
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('in_progress', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_status as enum ('pending', 'served', 'answered', 'expired', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pillar as enum ('reasoning', 'independence', 'tech', 'speed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_kind as enum ('single_choice', 'multi_choice', 'numeric', 'short_text', 'ordering', 'investigation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type integrity_risk as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_kind as enum ('cv');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 3. Shared trigger: set_updated_at (DATA_MODEL.md conventions)
-- =====================================================================
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- 4. Tables, in FK dependency order (DATA_MODEL.md §5: assessment_configs
-- before jobs; admin_users before everything that references it)
-- =====================================================================

-- 4.1 admin_users (§3.1)
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  email         citext not null unique,
  display_name  text not null,
  created_by    uuid references admin_users(id),
  disabled_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists set_updated_at on admin_users;
create trigger set_updated_at before update on admin_users
  for each row execute function set_updated_at();

-- 4.2 assessment_configs (§3.3)
create table if not exists assessment_configs (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  name_he       text not null,
  blueprint     jsonb not null,
  is_locked     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 4.3 jobs (§3.2)
create table if not exists jobs (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title_he              text not null,
  title_en              text,
  summary_he            text not null,
  description_he        text not null,
  description_en        text,
  hourly_rate_ils       numeric(8,2),
  hours_per_week        numeric(4,1),
  days_per_week         numeric(3,1),
  hours_per_day         numeric(3,1),
  engagement_type_he    text not null default 'קבלן עצמאי / נותן שירותים',
  location_he           text not null,
  hybrid_he             text,
  start_he              text not null default 'מיידי',
  requires_rishon       boolean not null default true,
  confirmations_he      jsonb not null,
  description_html      text not null,
  response_window_days  smallint not null default 14,
  send_rejection_email  boolean not null default true,
  is_active             boolean not null default false,
  assessment_config_id  uuid not null references assessment_configs(id),
  created_by            uuid references admin_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists jobs_active_idx on jobs (is_active, created_at desc);
drop trigger if exists set_updated_at on jobs;
create trigger set_updated_at before update on jobs
  for each row execute function set_updated_at();

-- 4.4 candidates (§3.4)
create table if not exists candidates (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null unique,
  phone_e164         text not null,
  first_name         text not null,
  last_name          text not null,
  date_of_birth      date not null,
  institution        text not null,
  degree_program     text not null,
  study_year         smallint not null check (study_year between 1 and 7),
  academic_average   numeric(5,2) not null check (academic_average between 0 and 100),
  linkedin_url       text,
  github_url         text,
  ip_prefix          inet,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists candidates_phone_idx on candidates (phone_e164);
create index if not exists candidates_name_idx  on candidates (last_name, first_name);
create index if not exists candidates_search_idx on candidates using gin (
  (first_name || ' ' || last_name || ' ' || email || ' ' || phone_e164) gin_trgm_ops
);
drop trigger if exists set_updated_at on candidates;
create trigger set_updated_at before update on candidates
  for each row execute function set_updated_at();

-- 4.5 applications (§3.5)
create table if not exists applications (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references candidates(id) on delete cascade,
  job_id                uuid not null references jobs(id) on delete restrict,
  stage                 application_stage not null default 'applied',
  stage_changed_at      timestamptz not null default now(),
  can_work_rishon       boolean not null,
  job_confirmed_at      timestamptz,
  briefing_seen_at      timestamptz,
  duplicate_phone_of    uuid references candidates(id),
  resume_code_hash      bytea not null,
  rejection_email_sent_at timestamptz,
  keep_indefinitely     boolean not null default false,
  source                text,
  user_agent_signup     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (candidate_id, job_id)
);
create index if not exists applications_job_stage_idx on applications (job_id, stage, created_at desc);
create index if not exists applications_created_idx   on applications (created_at desc);
drop trigger if exists set_updated_at on applications;
create trigger set_updated_at before update on applications
  for each row execute function set_updated_at();
alter table applications
  add constraint can_work_rishon_not_null check (can_work_rishon is not null);

-- 4.6 application_stage_history (§3.6)
create table if not exists application_stage_history (
  id              bigserial primary key,
  application_id  uuid not null references applications(id) on delete cascade,
  from_stage      application_stage,
  to_stage        application_stage not null,
  changed_by      uuid references admin_users(id),
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists ash_app_idx on application_stage_history (application_id, created_at);

-- 4.7 admin_notes (§3.7)
create table if not exists admin_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  author_id       uuid not null references admin_users(id),
  kind            text not null default 'note',
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists admin_notes_app_idx on admin_notes (application_id, created_at desc);
drop trigger if exists set_updated_at on admin_notes;
create trigger set_updated_at before update on admin_notes
  for each row execute function set_updated_at();

-- 4.8 consents (§3.8)
create table if not exists consents (
  id              bigserial primary key,
  application_id  uuid not null references applications(id) on delete cascade,
  kind            text not null,
  text_version    text not null,
  accepted_at     timestamptz not null default now(),
  ip_prefix       inet
);
create index if not exists consents_app_idx on consents (application_id);

-- 4.9 cv_files and cv_purge_queue (§3.9)
create table if not exists cv_files (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null unique references applications(id) on delete cascade,
  bucket          text not null default 'cv',
  object_path     text not null unique,
  original_name   text not null,
  mime_type       text not null check (mime_type in ('application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes      integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256          bytea not null,
  uploaded_at     timestamptz not null default now()
);

create table if not exists cv_purge_queue (
  object_path  text primary key,
  bucket       text not null,
  enqueued_at  timestamptz not null default now(),
  attempts     smallint not null default 0,
  last_error   text
);

create or replace function cv_enqueue_purge() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'DELETE' or new.object_path is distinct from old.object_path then
    insert into cv_purge_queue (object_path, bucket) values (old.object_path, old.bucket)
    on conflict (object_path) do nothing;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists cv_files_purge on cv_files;
create trigger cv_files_purge after delete or update of object_path on cv_files
  for each row execute function cv_enqueue_purge();

-- 4.10 assessment_sessions (§3.10)
create table if not exists assessment_sessions (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null unique references applications(id) on delete cascade,
  config_id           uuid not null references assessment_configs(id),
  config_version      int  not null,
  seed                bigint not null,
  status              session_status not null default 'in_progress',
  current_position    smallint not null default 1,
  total_items         smallint not null,
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  completed_at        timestamptz,
  client_instance_id  text,
  user_agent          text,
  screen_w            smallint, screen_h smallint, dpr numeric(3,2),
  timezone            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists sessions_status_idx on assessment_sessions (status, expires_at);
drop trigger if exists set_updated_at on assessment_sessions;
create trigger set_updated_at before update on assessment_sessions
  for each row execute function set_updated_at();

-- 4.11 assessment_items (§3.11)
create table if not exists assessment_items (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references assessment_sessions(id) on delete cascade,
  position         smallint not null,
  block_key        text not null,
  pillar           pillar not null,
  template_id      text not null,
  template_version smallint not null,
  variant_seed     bigint not null,
  kind             item_kind not null,
  difficulty       smallint not null check (difficulty between 1 and 3),
  time_limit_s     smallint not null,
  content          jsonb,
  answer_key       jsonb,
  status           item_status not null default 'pending',
  served_at        timestamptz,
  deadline_at      timestamptz,
  serve_nonce      bytea,
  outage_credit_ms integer not null default 0,
  finalized_at     timestamptz,
  unique (session_id, position)
);
create index if not exists items_session_pos_idx on assessment_items (session_id, position);
create index if not exists items_template_idx    on assessment_items (template_id);

-- 4.12 assessment_responses (§3.12)
create table if not exists assessment_responses (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null unique references assessment_items(id) on delete cascade,
  session_id         uuid not null references assessment_sessions(id) on delete cascade,
  answer             jsonb,
  is_correct         boolean,
  partial_credit     numeric(4,3),
  response_ms        integer,
  first_interaction_ms integer,
  answer_changes     smallint not null default 0,
  artifacts_opened   jsonb,
  received_at        timestamptz not null default now(),
  late_by_ms         integer not null default 0
);
create index if not exists responses_session_idx on assessment_responses (session_id);

-- 4.13 integrity_events (§3.13)
create table if not exists integrity_events (
  id              bigserial primary key,
  session_id      uuid not null references assessment_sessions(id) on delete cascade,
  item_id         uuid references assessment_items(id) on delete set null,
  kind            text not null,
  at              timestamptz not null,
  duration_ms     integer,
  meta            jsonb,
  ip              inet,
  client_instance_id text,
  created_at      timestamptz not null default now()
);
create index if not exists ie_session_at_idx on integrity_events (session_id, at);
create index if not exists ie_kind_idx on integrity_events (session_id, kind);

-- 4.14 assessment_results (§3.14)
create table if not exists assessment_results (
  session_id           uuid primary key references assessment_sessions(id) on delete cascade,
  application_id       uuid not null unique references applications(id) on delete cascade,
  job_id               uuid not null references jobs(id),
  scoring_version      smallint not null,
  score_reasoning      numeric(5,2) not null,
  score_independence   numeric(5,2) not null,
  score_tech           numeric(5,2) not null,
  score_speed          numeric(5,2) not null,
  score_overall        numeric(5,2) not null,
  confidence           numeric(3,2) not null,
  items_answered       smallint not null,
  items_expired        smallint not null,
  items_correct        smallint not null,
  median_response_ms   integer,
  integrity_risk       integrity_risk not null,
  integrity_score      numeric(5,2) not null,
  integrity_reasons    jsonb not null,
  breakdown            jsonb not null,
  computed_at          timestamptz not null default now(),
  integrity_ignore_focus     boolean not null default false,
  integrity_risk_adjusted    integrity_risk,
  integrity_adjusted_by      uuid references admin_users(id),
  integrity_adjust_reason    text,
  integrity_adjusted_at      timestamptz
);
create index if not exists results_job_overall_idx on assessment_results (job_id, score_overall desc);
create index if not exists results_job_risk_idx    on assessment_results (job_id, integrity_risk, score_overall desc);

-- 4.15 admin_audit_log (§3.15)
create table if not exists admin_audit_log (
  id           bigserial primary key,
  admin_id     uuid references admin_users(id),
  action       text not null,
  target_type  text not null,
  target_id    uuid not null,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_created_idx on admin_audit_log (created_at desc);

-- 4.16 rate_limits (§3.16)
create table if not exists rate_limits (
  key         text primary key,
  tokens      smallint not null,
  refilled_at timestamptz not null default now()
);

-- 4.17 liveness and maintenance (§3.17)
create table if not exists liveness (id boolean primary key default true check (id), at timestamptz not null default now());
insert into liveness (id) values (true) on conflict (id) do nothing;

create table if not exists maintenance (
  id          boolean primary key default true check (id),
  last_sweep  timestamptz not null default 'epoch',
  last_boot   timestamptz,
  last_outage_start timestamptz, last_outage_end timestamptz,
  db_size_bytes bigint, db_size_at timestamptz
);
insert into maintenance (id) values (true) on conflict (id) do nothing;

-- 4.18 email_outbox (§3.18)
create table if not exists email_outbox (
  id            bigserial primary key,
  to_email      citext not null,
  template      text not null,
  payload       jsonb not null,
  application_id uuid references applications(id) on delete cascade,
  attempts      smallint not null default 0,
  sent_at       timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);
create index if not exists email_outbox_pending_idx on email_outbox (created_at) where sent_at is null;

-- 4.19 admin_alerts (§3.19)
create table if not exists admin_alerts (
  id            bigserial primary key,
  code          text not null,
  severity      text not null check (severity in ('info','warning','critical')),
  message_he    text not null,
  meta          jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  dismissed_by  uuid references admin_users(id),
  dismissed_at  timestamptz
);
create unique index if not exists admin_alerts_code_key_idx on admin_alerts (code, (meta->>'key'));

-- 4.20 privacy_requests (§3.20)
create table if not exists privacy_requests (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null,
  kind          text not null check (kind in ('access','delete','correct')),
  status        text not null default 'open' check (status in ('open','done','rejected')),
  due_at        timestamptz not null default now() + interval '30 days',
  handled_by    uuid references admin_users(id),
  handled_at    timestamptz,
  note          text,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- 5. View for the admin list (§4)
-- =====================================================================
create or replace view admin_application_rows as
select a.id as application_id, a.job_id, a.stage, a.stage_changed_at, a.created_at as applied_at,
       a.can_work_rishon, a.duplicate_phone_of is not null as dup_phone,
       c.id as candidate_id, c.first_name, c.last_name, c.email, c.phone_e164,
       c.institution, c.degree_program, c.study_year, c.academic_average, c.date_of_birth,
       c.linkedin_url is not null as has_linkedin, c.github_url is not null as has_github,
       cv.id is not null as has_cv,
       s.status as session_status, s.started_at as assessment_started_at, s.completed_at,
       r.score_overall, r.score_reasoning, r.score_independence, r.score_tech, r.score_speed,
       r.confidence, coalesce(r.integrity_risk_adjusted, r.integrity_risk) as integrity_risk,
       percent_rank() over (partition by a.job_id order by r.score_overall nulls first) as pct_rank
from applications a
join candidates c on c.id = a.candidate_id
left join cv_files cv on cv.application_id = a.id
left join assessment_sessions s on s.application_id = a.id
left join assessment_results r on r.application_id = a.id;

-- =====================================================================
-- 6. Invariant triggers (§5)
-- =====================================================================
create or replace function items_served_once() returns trigger language plpgsql as $$
begin
  if old.served_at is not null and new.served_at is distinct from old.served_at then
    raise exception 'assessment_items.served_at is immutable once set (item %)', old.id;
  end if;
  return new;
end $$;
drop trigger if exists items_served_once on assessment_items;
create trigger items_served_once before update on assessment_items
  for each row execute function items_served_once();

-- deadline_at is immutable EXCEPT through apply_outage_credit(), which sets
-- app.outage_credit = 'on' for the duration of its own update
-- (ARCHITECTURE.md §5.2, DATA_MODEL.md §3.11).
create or replace function items_deadline_immutable() returns trigger language plpgsql as $$
begin
  if old.deadline_at is not null and new.deadline_at is distinct from old.deadline_at
     and coalesce(current_setting('app.outage_credit', true), 'off') <> 'on' then
    raise exception 'assessment_items.deadline_at can only change via apply_outage_credit() (item %)', old.id;
  end if;
  return new;
end $$;
drop trigger if exists items_deadline_immutable on assessment_items;
create trigger items_deadline_immutable before update on assessment_items
  for each row execute function items_deadline_immutable();

create or replace function results_immutable() returns trigger language plpgsql as $$
begin
  if (new.score_reasoning, new.score_independence, new.score_tech, new.score_speed, new.score_overall,
      new.confidence, new.items_answered, new.items_expired, new.items_correct, new.median_response_ms,
      new.integrity_risk, new.integrity_score, new.integrity_reasons, new.breakdown, new.scoring_version)
     is distinct from
     (old.score_reasoning, old.score_independence, old.score_tech, old.score_speed, old.score_overall,
      old.confidence, old.items_answered, old.items_expired, old.items_correct, old.median_response_ms,
      old.integrity_risk, old.integrity_score, old.integrity_reasons, old.breakdown, old.scoring_version)
  then
    raise exception 'assessment_results is immutable except for the integrity_*adjust*/integrity_ignore_focus override columns (session %)', old.session_id;
  end if;
  return new;
end $$;
drop trigger if exists results_immutable on assessment_results;
create trigger results_immutable before update on assessment_results
  for each row execute function results_immutable();

-- =====================================================================
-- 7. SECURITY DEFINER functions (the only write paths for their tables)
-- =====================================================================

-- 7.1 cv_upsert — the only way app_user can write cv_files (§3.9 rule).
-- The app uploads the new object to Storage BEFORE calling this, so a
-- failed upload never dereferences the old file.
create or replace function cv_upsert(
  p_application_id uuid,
  p_object_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 bytea
) returns cv_files
language plpgsql security definer set search_path = public as $$
declare
  result cv_files;
begin
  insert into cv_files (application_id, object_path, original_name, mime_type, size_bytes, sha256)
  values (p_application_id, p_object_path, p_original_name, p_mime_type, p_size_bytes, p_sha256)
  on conflict (application_id) do update
    set object_path = excluded.object_path,
        original_name = excluded.original_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        sha256 = excluded.sha256,
        uploaded_at = now()
  returning * into result;
  return result;
end $$;

-- 7.2 delete_candidate — cascades everything for one candidate (all of
-- their applications). The only path app_user has to remove candidate rows
-- (DATA_MODEL.md §6.1: no direct DELETE grant on candidates/applications).
create or replace function delete_candidate(p_candidate_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- cv_files rows cascade from applications -> cv_purge_queue via the
  -- cv_files_purge trigger fires as part of this cascade.
  delete from candidates where id = p_candidate_id;
end $$;

-- 7.3 delete_application — deletes a single application (e.g. duplicate
-- cleanup) without touching the candidate's other applications.
create or replace function delete_application(p_application_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from applications where id = p_application_id;
end $$;

-- 7.4 apply_outage_credit — the only path allowed to change deadline_at
-- after it is set (ARCHITECTURE.md §5.2). Called once at process boot, in
-- `system` context, when a liveness gap indicates the process was down
-- while items were live.
create or replace function apply_outage_credit(p_window_start timestamptz, p_window_end timestamptz)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_overlap_ms integer;
  v_count integer := 0;
  r record;
begin
  perform set_config('app.outage_credit', 'on', true);

  for r in
    select i.id, i.session_id, i.served_at, i.deadline_at, i.time_limit_s
    from assessment_items i
    where i.finalized_at is null
      and i.served_at is not null
      and i.deadline_at is not null
      and i.served_at < p_window_end
      and i.deadline_at > p_window_start
  loop
    v_overlap_ms := least(
      extract(epoch from (least(r.deadline_at, p_window_end) - greatest(r.served_at, p_window_start))) * 1000,
      r.time_limit_s * 1000
    )::integer;
    if v_overlap_ms > 0 then
      update assessment_items
        set deadline_at = deadline_at + make_interval(secs => v_overlap_ms / 1000.0),
            outage_credit_ms = outage_credit_ms + v_overlap_ms
        where id = r.id;

      update assessment_sessions
        set expires_at = expires_at + make_interval(secs => v_overlap_ms / 1000.0)
        where id = r.session_id;

      insert into integrity_events (session_id, item_id, kind, at, meta)
      values (r.session_id, r.id, 'server_outage', now(),
              jsonb_build_object('credit_ms', v_overlap_ms, 'window_start', p_window_start, 'window_end', p_window_end));

      v_count := v_count + 1;
    end if;
  end loop;

  perform set_config('app.outage_credit', 'off', true);

  update maintenance set last_outage_start = p_window_start, last_outage_end = p_window_end;

  return v_count;
end $$;

-- 7.5 finalize_session — marks a session completed/abandoned; scoring
-- itself is computed in the application (scoring.ts is a pure TS module per
-- ARCHITECTURE.md §4) and written into assessment_results by the same
-- request via a normal INSERT under `candidate` or `system` context. This
-- function only performs the session-row bookkeeping so partial writes
-- can't leave a session stuck in_progress past its wall clock.
create or replace function finalize_session(p_session_id uuid, p_status session_status)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update assessment_sessions
    set status = p_status,
        completed_at = coalesce(completed_at, now())
    where id = p_session_id and status = 'in_progress';
end $$;

-- 7.6 prune_retention — bounded retention sweep (§8). Batches of <= 200
-- candidates per call; called as sweep step 6 (see run_maintenance_sweep).
create or replace function prune_retention() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Full IP nulled after 90 days (integrity_events), batched.
  update integrity_events
    set ip = null
    where ip is not null and created_at < now() - interval '90 days'
    and id in (
      select id from integrity_events
      where ip is not null and created_at < now() - interval '90 days'
      limit 1000
    );

  -- Raw telemetry + rendered item content/answer keys pruned 12 months
  -- after session completion; scores/breakdown/integrity are kept.
  delete from integrity_events ie
  using assessment_sessions s
  where ie.session_id = s.id
    and s.completed_at is not null
    and s.completed_at < now() - interval '12 months'
    and ie.id in (
      select ie2.id from integrity_events ie2
      join assessment_sessions s2 on s2.id = ie2.session_id
      where s2.completed_at is not null and s2.completed_at < now() - interval '12 months'
      limit 1000
    );

  update assessment_items i
    set content = null, answer_key = null
    from assessment_sessions s
    where i.session_id = s.id
      and s.completed_at is not null
      and s.completed_at < now() - interval '12 months'
      and (i.content is not null or i.answer_key is not null)
      and i.id in (
        select i2.id from assessment_items i2
        join assessment_sessions s2 on s2.id = i2.session_id
        where s2.completed_at is not null and s2.completed_at < now() - interval '12 months'
          and (i2.content is not null or i2.answer_key is not null)
        limit 1000
      );

  -- Whole candidate deleted 24 months after latest application, unless any
  -- application is hired or keep_indefinitely.
  perform delete_candidate(c.id)
  from candidates c
  where c.id in (
    select candidate_id from (
      select a.candidate_id, max(a.created_at) as last_applied,
             bool_or(a.stage = 'hired') as any_hired,
             bool_or(a.keep_indefinitely) as any_kept
      from applications a
      group by a.candidate_id
    ) x
    where x.last_applied < now() - interval '24 months'
      and not x.any_hired and not x.any_kept
    limit 200
  );
end $$;

-- 7.7 run_maintenance_sweep — the scheduler without a scheduler
-- (ARCHITECTURE.md §8). Called from /api/health in `system` context. Wins
-- the lock at most once per hour; bounded to a fast set of batched steps.
create or replace function run_maintenance_sweep() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  won_lock boolean;
begin
  update maintenance set last_sweep = now()
    where last_sweep < now() - interval '1 hour'
    returning true into won_lock;

  if won_lock is not true then
    return false;
  end if;

  -- (1) liveness touch happens from application code on every request, not here.
  -- (2)+(3)+(6) IP nulling / rate-limit cleanup / retention pruning:
  delete from rate_limits where refilled_at < now() - interval '1 hour';
  perform prune_retention();

  -- (7) invariant checks -> admin_alerts rows. The concrete threshold
  -- queries (template accuracy, expiry-among-strong, scenario drift,
  -- purge backlog, email failures, DB size, outage credits —
  -- ARCHITECTURE.md §10) are intentionally NOT fully implemented here:
  -- most of them need assessment/bank analytics that don't exist until the
  -- assessment-engine and admin-ui engineers build the bank and results
  -- pipeline. This function still performs the two checks that only need
  -- data that already exists at this layer, so the health endpoint has
  -- real signal from day one.
  insert into admin_alerts (code, severity, message_he, meta)
  select 'cv_purge_backlog', 'critical',
         'תור מחיקת קבצים תקוע: ' || count(*) || ' קבצים ממתינים מעל 24 שעות',
         jsonb_build_object('key', 'cv_purge_backlog', 'count', count(*))
  from cv_purge_queue
  where enqueued_at < now() - interval '24 hours'
  having count(*) > 0
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  insert into admin_alerts (code, severity, message_he, meta)
  select 'email_failures', 'warning',
         count(*) || ' מיילים נכשלו יותר מ-3 פעמים',
         jsonb_build_object('key', 'email_failures', 'count', count(*))
  from email_outbox
  where sent_at is null and attempts > 3
  having count(*) > 0
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  update maintenance set db_size_bytes = pg_database_size(current_database()), db_size_at = now();

  return true;
end $$;

-- =====================================================================
-- 8. Row Level Security (§6)
-- =====================================================================
create or replace function app_ctx() returns text language sql stable as $$
  select current_setting('app.context', true)
$$;

create or replace function app_app_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.application_id', true), '')::uuid
$$;

create or replace function app_is_admin() returns boolean language sql stable security definer as $$
  select exists (
    select 1 from admin_users
    where id = nullif(current_setting('app.admin_id', true), '')::uuid
      and disabled_at is null
  )
$$;

alter table admin_users enable row level security;
alter table jobs enable row level security;
alter table assessment_configs enable row level security;
alter table candidates enable row level security;
alter table applications enable row level security;
alter table application_stage_history enable row level security;
alter table admin_notes enable row level security;
alter table consents enable row level security;
alter table cv_files enable row level security;
alter table cv_purge_queue enable row level security;
alter table assessment_sessions enable row level security;
alter table assessment_items enable row level security;
alter table assessment_responses enable row level security;
alter table integrity_events enable row level security;
alter table assessment_results enable row level security;
alter table admin_audit_log enable row level security;
alter table rate_limits enable row level security;
alter table liveness enable row level security;
alter table maintenance enable row level security;
alter table email_outbox enable row level security;
alter table admin_alerts enable row level security;
alter table privacy_requests enable row level security;

-- Candidate-scoped: applications, consents, cv_files, assessment_sessions, assessment_results
drop policy if exists cand_own on applications;
create policy cand_own on applications for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()) or (app_ctx() = 'candidate' and id = app_app_id()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()) or (app_ctx() = 'candidate' and id = app_app_id()));

drop policy if exists cand_own on consents;
create policy cand_own on consents for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()));

drop policy if exists cand_own on cv_files;
create policy cand_own on cv_files for select to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()));

drop policy if exists cand_own on assessment_sessions;
create policy cand_own on assessment_sessions for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()));

drop policy if exists cand_own on assessment_results;
create policy cand_own on assessment_results for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and application_id = app_app_id()));

-- Session-scoped: assessment_items, assessment_responses, integrity_events (via session -> application)
drop policy if exists cand_own on assessment_items;
create policy cand_own on assessment_items for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())));

drop policy if exists cand_own on assessment_responses;
create policy cand_own on assessment_responses for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())));

drop policy if exists cand_own on integrity_events;
create policy cand_own on integrity_events for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())));

-- candidates: candidate context may read/update only its own row (joined through applications)
drop policy if exists cand_own on candidates;
create policy cand_own on candidates for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and id in (select candidate_id from applications where id = app_app_id())))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and id in (select candidate_id from applications where id = app_app_id())));

-- jobs, assessment_configs: candidate context may SELECT active rows only; admin/system full
drop policy if exists cand_read_active on jobs;
create policy cand_read_active on jobs for select to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and is_active));
drop policy if exists admin_write on jobs;
create policy admin_write on jobs for insert to app_user
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));
drop policy if exists admin_update on jobs;
create policy admin_update on jobs for update to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists cand_read_active on assessment_configs;
create policy cand_read_active on assessment_configs for select to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()) or app_ctx() = 'candidate');

-- admin-only tables: admin_users, admin_notes, application_stage_history,
-- admin_audit_log, admin_alerts, privacy_requests, cv_purge_queue
drop policy if exists admin_only on admin_users;
create policy admin_only on admin_users for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists admin_only on admin_notes;
create policy admin_only on admin_notes for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists admin_only on application_stage_history;
create policy admin_only on application_stage_history for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists admin_only on admin_audit_log;
create policy admin_only on admin_audit_log for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists admin_only on admin_alerts;
create policy admin_only on admin_alerts for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists admin_only on privacy_requests;
create policy admin_only on privacy_requests for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

-- privacy_requests may also be INSERTed by an unauthenticated candidate via
-- the public /privacy form; that request runs in `system` context after its
-- own rate-limit + email-verification check (there is no per-row owner to
-- scope to before the email link is clicked), matching DATA_MODEL.md §3.20.

drop policy if exists admin_only on cv_purge_queue;
create policy admin_only on cv_purge_queue for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

-- utility tables: system, plus the specific insert/update the app performs in any context
drop policy if exists rate_limit_any on rate_limits;
create policy rate_limit_any on rate_limits for all to app_user
  using (app_ctx() in ('system', 'admin', 'candidate'))
  with check (app_ctx() in ('system', 'admin', 'candidate'));

drop policy if exists liveness_any on liveness;
create policy liveness_any on liveness for all to app_user
  using (app_ctx() in ('system', 'admin', 'candidate'))
  with check (app_ctx() in ('system', 'admin', 'candidate'));

drop policy if exists maintenance_system on maintenance;
create policy maintenance_system on maintenance for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists email_outbox_any on email_outbox;
create policy email_outbox_any on email_outbox for all to app_user
  using (app_ctx() in ('system', 'admin', 'candidate'))
  with check (app_ctx() in ('system', 'admin', 'candidate'));

-- =====================================================================
-- 9. Grants (§6.1) — explicit, no wildcard grants.
-- =====================================================================
grant select, insert, update on jobs, candidates, applications, application_stage_history,
      admin_notes, consents, assessment_sessions, assessment_items, assessment_responses,
      integrity_events, assessment_results, rate_limits, liveness, maintenance, email_outbox,
      admin_alerts, privacy_requests, admin_audit_log, admin_users to app_user;
grant delete on rate_limits, email_outbox, cv_purge_queue, integrity_events, admin_alerts to app_user;
grant select on cv_files, cv_purge_queue, assessment_configs to app_user;
grant execute on function cv_upsert, delete_candidate, delete_application, apply_outage_credit,
      finalize_session, prune_retention, run_maintenance_sweep to app_user;
grant usage, select on all sequences in schema public to app_user;

revoke all on all tables in schema public from anon, authenticated;
revoke all on schema auth, storage from app_user;

-- Boot-time migration-version check (DEPLOYMENT.md §5) reads the CLI's own
-- migration ledger; grant read access if that schema exists (it is created
-- by the Supabase CLI itself, not by this migration).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'supabase_migrations') then
    execute 'grant usage on schema supabase_migrations to app_user';
    execute 'grant select on supabase_migrations.schema_migrations to app_user';
  end if;
end $$;

-- =====================================================================
-- 10. Storage bucket (DEPLOYMENT.md §6) — private, server-only access.
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cv', 'cv', false, 5242880,
            array['application/pdf',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do nothing;
  end if;
end $$;
-- No storage policies: access is exclusively through server-side signed
-- URLs created with the service-role key (DATA_MODEL.md §6.3).
