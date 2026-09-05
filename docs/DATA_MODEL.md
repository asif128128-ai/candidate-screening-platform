# DATA MODEL

Postgres 15 (Supabase). All tables in schema `public`. All timestamps `timestamptz`. All primary keys `uuid` (`gen_random_uuid()`). The application connects as a dedicated least-privilege role **`app_user`** (`NOBYPASSRLS`); RLS is **enabled on every table with real policies** that scope each transaction by a request context (§6). Migrations run as the project owner and live in `/supabase/migrations/` (see `DEPLOYMENT.md`).

Conventions: `created_at` default `now()`; `updated_at` maintained by a shared trigger `set_updated_at()`; soft-delete is not used anywhere (deletion is real, cascading).

## 1. Entity overview

```
admin_users                       jobs ──────────< applications >────── candidates
                                    │                  │                    │
                                    │                  ├──< application_stage_history
                                    │                  ├──< admin_notes
                                    │                  ├──1 cv_files
                                    │                  ├──< consents
                                    │                  └──1 assessment_sessions
                                    │                             ├──< assessment_items ──1 assessment_responses
                                    │                             ├──< integrity_events
                                    │                             └──1 assessment_results
                                    └── assessment_config_id ──▶ assessment_configs
utility: rate_limits, liveness, maintenance, cv_purge_queue, email_outbox, admin_alerts, privacy_requests, admin_audit_log
```

## 2. Enums

```sql
create type application_stage as enum (
  'applied',              -- הוגשה מועמדות
  'assessment_started',   -- המבחן התחיל
  'assessment_completed', -- המבחן הושלם
  'under_review',         -- בבדיקה
  'interview',            -- ראיון
  'rejected',             -- נדחה
  'hired'                 -- התקבל/ה
);

create type session_status as enum ('in_progress', 'completed', 'abandoned');
create type item_status    as enum ('pending', 'served', 'answered', 'expired', 'skipped');
create type pillar         as enum ('reasoning', 'independence', 'tech', 'speed');
create type item_kind      as enum ('single_choice', 'multi_choice', 'numeric', 'short_text', 'ordering', 'investigation');
create type integrity_risk as enum ('low', 'medium', 'high');
create type file_kind      as enum ('cv');
```

`applied → assessment_started → assessment_completed` are set by the system. `under_review`, `interview`, `rejected`, `hired` are set by admins. Admins may also move a candidate back to any stage; every change is written to `application_stage_history`.

## 3. Tables

### 3.1 `admin_users`
Allowlist bound to Supabase Auth. A user can log in only if their auth email exists here and `disabled_at IS NULL`.

```sql
create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,                 -- auth.users.id, filled on first login
  email         citext not null unique,
  display_name  text not null,
  created_by    uuid references admin_users(id),
  disabled_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

No roles column in v1. If roles are ever needed, add `role text not null default 'admin'` — nothing else changes.

### 3.2 `jobs`

```sql
create table jobs (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,          -- URL: /jobs/{slug}
  title_he              text not null,
  title_en              text,
  summary_he            text not null,                 -- one-liner for lists
  description_he        text not null,                 -- markdown, candidate-facing step 2
  description_en        text,
  hourly_rate_ils       numeric(8,2),
  hours_per_week        numeric(4,1),
  days_per_week         numeric(3,1),
  hours_per_day         numeric(3,1),
  engagement_type_he    text not null default 'קבלן עצמאי / נותן שירותים',
  location_he           text not null,                 -- 'ראשון לציון והסביבה'
  hybrid_he             text,                          -- 'היברידי אפשרי, לא מרחוק בלבד'
  start_he              text not null default 'מיידי',
  requires_rishon       boolean not null default true, -- controls the "לא בראשון" badge; the question is always asked
  confirmations_he      jsonb not null,                -- array of 3 confirmation sentences shown in step 2 (seeded defaults)
  description_html      text not null,                 -- rendered from description_he on save (no runtime markdown lib)
  response_window_days  smallint not null default 14,  -- promised on the done page and in the confirmation email
  send_rejection_email  boolean not null default true, -- closure notice when stage → rejected
  is_active             boolean not null default false,
  assessment_config_id  uuid not null references assessment_configs(id),
  created_by            uuid references admin_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index jobs_active_idx on jobs (is_active, created_at desc);
```

Commercial fields are structured (not just markdown) so the job step can render a consistent "כרטיס תנאים" and so future jobs cannot forget to state them.

### 3.3 `assessment_configs`
Answers "how does assessment configuration relate to jobs" without over-engineering: a config is a named blueprint (which blocks, how many items per block, per-block time limits). Jobs point to a config. V1 ships one config `default_tech_student_v1`. A new job reuses it by default; a different profile is a new row, not new code.

```sql
create table assessment_configs (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,     -- 'default_tech_student_v1'
  name_he       text not null,
  blueprint     jsonb not null,           -- validated by zod BlueprintSchema at load time
  is_locked     boolean not null default true,  -- locked configs cannot be edited (results comparability)
  created_at    timestamptz not null default now()
);
```

Blueprint shape (see `ASSESSMENT_DESIGN.md` §3):
```json
{
  "version": 1,
  "blocks": [
    {"key":"speed",        "pillar":"speed",        "count":10, "time_limit_s":20,  "pool":"speed.*"},
    {"key":"reasoning",    "pillar":"reasoning",    "count":6,  "time_limit_s":75,  "pool":"reasoning.*"},
    {"key":"tech",         "pillar":"tech",         "count":7,  "time_limit_s":60,  "pool":"tech.*"},
    {"key":"investigate",  "pillar":"independence", "count":4,  "time_limit_s":180, "pool":"investigate.*"}
  ],
  "weights": {"reasoning":0.30, "independence":0.30, "tech":0.25, "speed":0.15},
  "session_wall_clock_min": 75
}
```

### 3.4 `candidates`
One row per person (keyed by normalized email). A person may apply to several jobs.

```sql
create table candidates (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null unique,          -- normalized lowercase
  phone_e164         text not null,                   -- '+9725XXXXXXXX'
  first_name         text not null,
  last_name          text not null,
  date_of_birth      date not null,
  institution        text not null,                   -- free text with autocomplete list
  degree_program     text not null,
  study_year         smallint not null check (study_year between 1 and 7),
  academic_average   numeric(5,2) not null check (academic_average between 0 and 100),
  linkedin_url       text,
  github_url         text,
  ip_prefix          inet,                            -- truncated /24 or /48 at signup
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index candidates_phone_idx on candidates (phone_e164);
create index candidates_name_idx  on candidates (last_name, first_name);
create index candidates_search_idx on candidates using gin (
  (first_name || ' ' || last_name || ' ' || email || ' ' || phone_e164) gin_trgm_ops
);
```

`date_of_birth` is displayed to admins (with computed age) and is never read by scoring code (enforced by the pure-function signature: `scoreSession()` receives items, responses, and events only).

### 3.5 `applications`
One per (candidate, job). The central row for the admin.

```sql
create table applications (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references candidates(id) on delete cascade,
  job_id                uuid not null references jobs(id) on delete restrict,
  stage                 application_stage not null default 'applied',
  stage_changed_at      timestamptz not null default now(),
  can_work_rishon       boolean not null,
  job_confirmed_at      timestamptz,                 -- step 2 acknowledgement
  briefing_seen_at      timestamptz,                 -- step 3 seen
  duplicate_phone_of    uuid references candidates(id),  -- set when phone matches another candidate
  resume_code_hash      bytea not null,              -- sha256 of the 8-char resume code shown to the candidate (CANDIDATE_FLOW.md §2.4)
  rejection_email_sent_at timestamptz,               -- closure notice sent (CANDIDATE_FLOW.md §6)
  keep_indefinitely     boolean not null default false, -- admin "שמור" flag: exempt from retention pruning (§8)
  source                text,                        -- utm/source tag from the landing URL, optional
  user_agent_signup     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (candidate_id, job_id)
);
create index applications_job_stage_idx on applications (job_id, stage, created_at desc);
create index applications_created_idx   on applications (created_at desc);
```

### 3.6 `application_stage_history`

```sql
create table application_stage_history (
  id              bigserial primary key,
  application_id  uuid not null references applications(id) on delete cascade,
  from_stage      application_stage,
  to_stage        application_stage not null,
  changed_by      uuid references admin_users(id),    -- null = system
  note            text,
  created_at      timestamptz not null default now()
);
create index ash_app_idx on application_stage_history (application_id, created_at);
```

### 3.7 `admin_notes`

```sql
create table admin_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  author_id       uuid not null references admin_users(id),
  kind            text not null default 'note',   -- 'note' | 'integrity_reviewed' | 'assessment_reset'
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index admin_notes_app_idx on admin_notes (application_id, created_at desc);
```

### 3.8 `consents`
Records what the candidate agreed to and the exact text version.

```sql
create table consents (
  id              bigserial primary key,
  application_id  uuid not null references applications(id) on delete cascade,
  kind            text not null,       -- 'privacy_v1', 'assessment_monitoring_v1'
  text_version    text not null,       -- hash of the displayed text
  accepted_at     timestamptz not null default now(),
  ip_prefix       inet
);
create index consents_app_idx on consents (application_id);
```

### 3.9 `cv_files` and `cv_purge_queue`
Metadata for the private Storage object. At most one per application (re-upload replaces). **Storage cleanup is guaranteed by the schema, not by any single code path.**

```sql
create table cv_files (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null unique references applications(id) on delete cascade,
  bucket          text not null default 'cv',
  object_path     text not null unique,   -- '{application_id}/{uuid}.pdf'
  original_name   text not null,
  mime_type       text not null check (mime_type in ('application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes      integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256          bytea not null,
  uploaded_at     timestamptz not null default now()
);

-- Every object path that stops being referenced lands here, whatever caused it
-- (admin delete, bulk delete, retention pruning, cascade from candidates, re-upload, manual SQL).
create table cv_purge_queue (
  object_path  text primary key,
  bucket       text not null,
  enqueued_at  timestamptz not null default now(),
  attempts     smallint not null default 0,
  last_error   text
);

create function cv_enqueue_purge() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'DELETE' or new.object_path is distinct from old.object_path then
    insert into cv_purge_queue (object_path, bucket) values (old.object_path, old.bucket)
    on conflict (object_path) do nothing;
  end if;
  return coalesce(new, old);
end $$;
create trigger cv_files_purge after delete or update of object_path on cv_files
  for each row execute function cv_enqueue_purge();
```

Rules:
- `app_user` has **no direct INSERT/UPDATE on `cv_files`**. The only write path is `cv_upsert(application_id, object_path, original_name, mime_type, size_bytes, sha256)` (`SECURITY DEFINER`), which inserts or replaces the row; a replace fires the trigger and the previous object is queued. The app uploads the new object **before** calling `cv_upsert`, so a failed upload never dereferences the old file.
- The queue is drained (Storage delete, then queue row delete) by the hourly sweep and opportunistically by every CV upload/download request. Entries older than 24 h make `/api/health` return a warning and Sentry alerts; entries with `attempts ≥ 10` are surfaced on the admin Settings page.
- **Reconciliation** (on demand, Settings → "בדיקת קבצים"): lists bucket objects, diffs against `cv_files.object_path` ∪ `cv_purge_queue.object_path`, and offers to queue any unreferenced object. This is the audit that proves the invariant rather than assuming it.

### 3.10 `assessment_sessions`
One per application (a candidate gets exactly one attempt per job; admin can explicitly "reset" which deletes the session and its children and writes a stage-history note).

```sql
create table assessment_sessions (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null unique references applications(id) on delete cascade,
  config_id           uuid not null references assessment_configs(id),
  config_version      int  not null,
  seed                bigint not null,
  status              session_status not null default 'in_progress',
  current_position    smallint not null default 1,   -- 1-based index into items
  total_items         smallint not null,
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,           -- started_at + wall clock cap
  completed_at        timestamptz,
  client_instance_id  text,                            -- last seen runner instance (random per tab load)
  user_agent          text,
  screen_w            smallint, screen_h smallint, dpr numeric(3,2),
  timezone            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index sessions_status_idx on assessment_sessions (status, expires_at);
```

### 3.11 `assessment_items`
Materialized question instances. Content is stored so the admin can see exactly what the candidate saw, even after templates change (pruned after the retention window in §8; scores and breakdown survive).

```sql
create table assessment_items (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references assessment_sessions(id) on delete cascade,
  position         smallint not null,                -- 1..N, serve order
  block_key        text not null,                    -- 'speed' | 'reasoning' | 'tech' | 'investigate'
  pillar           pillar not null,
  template_id      text not null,                    -- 'reasoning.seq_arith_v1'
  template_version smallint not null,
  variant_seed     bigint not null,
  kind             item_kind not null,
  difficulty       smallint not null check (difficulty between 1 and 3),
  time_limit_s     smallint not null,
  content          jsonb,                            -- rendered prompt, options, artifacts (candidate-visible); nulled by retention pruning
  answer_key       jsonb,                            -- never sent to client; nulled by retention pruning
  status           item_status not null default 'pending',
  served_at        timestamptz,                      -- set ONCE on first serve
  deadline_at      timestamptz,                      -- served_at + time_limit_s (+ outage credit, see below)
  serve_nonce      bytea,                            -- 16 random bytes set with served_at; item_token = HMAC(id ‖ nonce)
  outage_credit_ms integer not null default 0,       -- deadline extension granted by apply_outage_credit()
  finalized_at     timestamptz,
  unique (session_id, position)
);
create index items_session_pos_idx on assessment_items (session_id, position);
create index items_template_idx    on assessment_items (template_id);  -- bank analytics
```

`served_at`/`deadline_at`/`serve_nonce` are set with `UPDATE … SET served_at = now() … WHERE served_at IS NULL` — the row can never be re-armed. The single exception is **server outage credit**: `apply_outage_credit(window_start, window_end)` (`SECURITY DEFINER`, called only at process boot in `system` context, see `ARCHITECTURE.md` §5.2) extends `deadline_at` of unfinalized items overlapping the window by the overlap, capped at `time_limit_s`, and records `outage_credit_ms`. The `items_deadline_immutable` trigger permits the change only when `current_setting('app.outage_credit', true) = 'on'`, which only that function sets.

### 3.12 `assessment_responses`
One per item (also written for expired items, with `answer = null`).

```sql
create table assessment_responses (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null unique references assessment_items(id) on delete cascade,
  session_id         uuid not null references assessment_sessions(id) on delete cascade,
  answer             jsonb,                          -- null when expired/skipped
  is_correct         boolean,                        -- null for expired
  partial_credit     numeric(4,3),                   -- 0..1 for multi-part items
  response_ms        integer,                        -- server: received_at - served_at
  first_interaction_ms integer,                      -- client: first click/keypress after render
  answer_changes     smallint not null default 0,
  artifacts_opened   jsonb,                          -- investigation items: ordered list of artifact keys + t
  received_at        timestamptz not null default now(),
  late_by_ms         integer not null default 0      -- >0 only within grace window
);
create index responses_session_idx on assessment_responses (session_id);
```

### 3.13 `integrity_events`
Raw telemetry. Append-only.

```sql
create table integrity_events (
  id              bigserial primary key,
  session_id      uuid not null references assessment_sessions(id) on delete cascade,
  item_id         uuid references assessment_items(id) on delete set null,
  kind            text not null,   -- see ANTI_CHEATING.md §3 for the closed list
  at              timestamptz not null,               -- server-adjusted client time
  duration_ms     integer,                             -- for hidden/blur spans
  meta            jsonb,                               -- small, kind-specific
  ip              inet,                                -- full IP; nulled after 90 days lazily
  client_instance_id text,
  created_at      timestamptz not null default now()
);
create index ie_session_at_idx on integrity_events (session_id, at);
create index ie_kind_idx on integrity_events (session_id, kind);
```

### 3.14 `assessment_results`
Denormalized, written once at completion. Everything the admin list sorts on lives here.

```sql
create table assessment_results (
  session_id           uuid primary key references assessment_sessions(id) on delete cascade,
  application_id       uuid not null unique references applications(id) on delete cascade,
  job_id               uuid not null references jobs(id),
  scoring_version      smallint not null,
  score_reasoning      numeric(5,2) not null,   -- 0..100
  score_independence   numeric(5,2) not null,
  score_tech           numeric(5,2) not null,
  score_speed          numeric(5,2) not null,
  score_overall        numeric(5,2) not null,
  confidence           numeric(3,2) not null,   -- 0..1, share of items with a valid response
  items_answered       smallint not null,
  items_expired        smallint not null,
  items_correct        smallint not null,
  median_response_ms   integer,
  integrity_risk       integrity_risk not null,
  integrity_score      numeric(5,2) not null,   -- 0..100 raw, higher = more concerning
  integrity_reasons    jsonb not null,          -- [{code, he, weight, evidence}]
  breakdown            jsonb not null,          -- per-block and per-item summary for the detail view
  computed_at          timestamptz not null default now(),
  -- admin override (the only mutable columns; see ANTI_CHEATING.md §8)
  integrity_ignore_focus     boolean not null default false,
  integrity_risk_adjusted    integrity_risk,    -- recomputed level when ignore_focus is set
  integrity_adjusted_by      uuid references admin_users(id),
  integrity_adjust_reason    text,
  integrity_adjusted_at      timestamptz
);
create index results_job_overall_idx on assessment_results (job_id, score_overall desc);
create index results_job_risk_idx    on assessment_results (job_id, integrity_risk, score_overall desc);
```

Percentile rank is computed at query time with `percent_rank() over (partition by job_id order by score_overall)` — always correct without a recompute job, and a few milliseconds at the stated scale (hundreds to low thousands of results per job; the window is evaluated over the whole job partition on every list render). If a single job ever exceeds ~20,000 results, the fallback is a `pct_rank` column on this table refreshed at completion time; not built now.

### 3.15 `admin_audit_log`
The only trace of destructive/administrative actions; never contains PII.

```sql
create table admin_audit_log (
  id           bigserial primary key,
  admin_id     uuid references admin_users(id),
  action       text not null,        -- 'candidate.delete' | 'assessment.reset' | 'job.update' | 'admin.add' | 'admin.disable' | 'integrity.override'
  target_type  text not null,        -- 'candidate' | 'application' | 'job' | 'admin_user'
  target_id    uuid not null,
  meta         jsonb,                -- non-PII details (e.g. job slug, reason)
  created_at   timestamptz not null default now()
);
create index audit_created_idx on admin_audit_log (created_at desc);
```

### 3.16 `rate_limits`

```sql
create table rate_limits (
  key         text primary key,          -- 'signup:1.2.3.0' | 'resume:email' | 'login:ip'
  tokens      smallint not null,
  refilled_at timestamptz not null default now()
);
```

### 3.17 `liveness` and `maintenance` (the scheduler without a scheduler)

```sql
create table liveness (id boolean primary key default true check (id), at timestamptz not null default now());
insert into liveness default values;
-- touched by any request at most once per 15 s: UPDATE liveness SET at = now() WHERE at < now() - interval '15 seconds'

create table maintenance (
  id          boolean primary key default true check (id),
  last_sweep  timestamptz not null default 'epoch',
  last_boot   timestamptz,
  last_outage_start timestamptz, last_outage_end timestamptz,
  db_size_bytes bigint, db_size_at timestamptz
);
insert into maintenance default values;
-- sweep lock: UPDATE maintenance SET last_sweep = now() WHERE last_sweep < now() - interval '1 hour' RETURNING 1
```

### 3.18 `email_outbox`
Email is never sent inside a candidate transaction. Rows are inserted transactionally and delivered right after commit (same request) with retry by the sweep.

```sql
create table email_outbox (
  id            bigserial primary key,
  to_email      citext not null,
  template      text not null,      -- 'application_received' | 'resume_otp' | 'not_moving_forward' | 'admin_invite_notice'
  payload       jsonb not null,
  application_id uuid references applications(id) on delete cascade,
  attempts      smallint not null default 0,
  sent_at       timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);
create index email_outbox_pending_idx on email_outbox (created_at) where sent_at is null;
```

### 3.19 `admin_alerts`
Passive banners produced by the sweep's invariant checks (`ARCHITECTURE.md` §10). Dismissable; re-created if the condition persists.

```sql
create table admin_alerts (
  id            bigserial primary key,
  code          text not null,          -- 'template_accuracy' | 'template_expiry_strong' | 'scenario_drift' | 'cv_purge_backlog' | 'email_failures' | 'db_size' | 'outage_credit'
  severity      text not null check (severity in ('info','warning','critical')),
  message_he    text not null,
  meta          jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  dismissed_by  uuid references admin_users(id),
  dismissed_at  timestamptz,
  unique (code, (meta->>'key'))
);
```

### 3.20 `privacy_requests`
Auditable queue for access/deletion requests so a lost email cannot mean a missed legal obligation.

```sql
create table privacy_requests (
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
```
Created either by an admin (from the inbox) or by the candidate through the public `/privacy` form (rate-limited, email-verified with a one-click link). Open requests past `due_at` raise an `admin_alerts` row.

## 4. Views for the admin list

One view backs the candidates table so the query is simple and the index plan is stable:

```sql
create view admin_application_rows as
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
```

## 5. Integrity and invariants (DB-enforced where cheap)

- `applications (candidate_id, job_id)` unique → one application per job per person.
- `assessment_sessions.application_id` unique → one attempt.
- `assessment_items (session_id, position)` unique.
- `assessment_responses.item_id` unique → one answer per item.
- Trigger `items_served_once`: `BEFORE UPDATE` raises if `OLD.served_at IS NOT NULL AND NEW.served_at IS DISTINCT FROM OLD.served_at`.
- Trigger `items_deadline_immutable`: same for `deadline_at`.
- Trigger `results_immutable`: on `assessment_results`, any `UPDATE` that changes a column other than the five `integrity_*adjust*`/`integrity_ignore_focus` override columns raises. Rows are otherwise removed only by cascade via admin reset.
- Migration order: `assessment_configs` is created before `jobs` (FK dependency); `admin_users` before everything that references it.
- Check: `applications.can_work_rishon` is `not null` even if `jobs.requires_rishon = false` (the question is always asked; only the flag styling changes).

## 6. Roles, grants and RLS (defense in depth for the credential in daily use)

### 6.1 Roles
```sql
create role app_user login password '<set at setup>' nobypassrls noinherit;
grant usage on schema public to app_user;
grant select, insert, update on jobs, candidates, applications, application_stage_history,
      admin_notes, consents, assessment_sessions, assessment_items, assessment_responses,
      integrity_events, assessment_results, rate_limits, liveness, maintenance, email_outbox,
      admin_alerts, privacy_requests, admin_audit_log, admin_users to app_user;
grant delete on rate_limits, email_outbox, cv_purge_queue, integrity_events, admin_alerts to app_user;
grant select on cv_files, cv_purge_queue, assessment_configs to app_user;
grant execute on function cv_upsert, delete_candidate, delete_application, apply_outage_credit,
      finalize_session, prune_retention to app_user;
revoke all on all tables in schema public from anon, authenticated;
revoke all on schema auth, storage from app_user;
```
Deletion of candidates/applications/sessions is only possible through the `SECURITY DEFINER` functions (`delete_candidate`, `delete_application`, `prune_retention`), which cascade; `app_user` has no direct `DELETE` on those tables. The migration/owner credential is never on Render.

### 6.2 Request context
Every transaction begins with:
```sql
select set_config('app.context', $1, true);          -- 'candidate' | 'admin' | 'system'
select set_config('app.application_id', $2, true);   -- candidate transactions
select set_config('app.admin_id', $3, true);         -- admin transactions
```
`SET LOCAL` semantics (third argument `true`) are compatible with Supavisor transaction mode. The `postgres.js` wrapper `withCandidate(applicationId, fn)` / `withAdmin(adminId, fn)` / `withSystem(fn)` is the only way application code gets a connection; there is no "raw" query helper.

### 6.3 Policies (pattern)
```sql
alter table <every table> enable row level security;

create function app_ctx() returns text language sql stable as $$ select current_setting('app.context', true) $$;
create function app_app_id() returns uuid language sql stable as $$ select nullif(current_setting('app.application_id', true), '')::uuid $$;
create function app_is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from admin_users where id = nullif(current_setting('app.admin_id', true), '')::uuid and disabled_at is null) $$;

-- Candidate-scoped tables (applications, consents, cv_files, assessment_sessions, assessment_results):
create policy cand_own on applications for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()) or (app_ctx() = 'candidate' and id = app_app_id()))
  with check (same expression);
-- Session-scoped tables (assessment_items, assessment_responses, integrity_events): via session → application
create policy cand_own on assessment_items for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin())
         or (app_ctx() = 'candidate' and session_id in (select id from assessment_sessions where application_id = app_app_id())));
-- candidates: candidate context may read/update only its own row (join through applications)
-- jobs, assessment_configs: candidate context may SELECT active rows only; admin full; system full
-- admin-only tables (admin_users, admin_notes, application_stage_history, admin_audit_log, admin_alerts, privacy_requests, cv_purge_queue): admin or system only
-- utility (rate_limits, liveness, maintenance, email_outbox): system, plus the specific insert/update the app performs in any context
```
A candidate transaction cannot read another application's rows even if the application code omits every `WHERE`; an admin transaction cannot run at all unless its `app.admin_id` is an enabled admin. pgTAP tests in `TEST_STRATEGY.md` §7 assert isolation at this layer.

Storage bucket `cv`: `public = false`, no storage policies; access is exclusively through server-side signed URLs created with the service-role key.

## 7. Seed data (migration `0002_seed.sql`)

- `assessment_configs`: `default_tech_student_v1` with the blueprint above.
- `jobs`: the Rishon LeZion part-time tech role, `slug = 'student-tech-2026'`, active, with the full Hebrew description (text in `ASSESSMENT_DESIGN.md` Appendix A is the candidate-facing job text and is copied verbatim into the seed).
- `admin_users`: none — created by the bootstrap script with the hiring manager's email.

## 8. Retention (bounded, enforced by the hourly sweep)

Growth per completed candidate is ≈ 150–250 KB of row + index data (27 items with rendered content and keys, 27 responses, up to 200 telemetry rows). Unbounded retention would reach Supabase Pro's 8 GB included DB around 30–40k cumulative candidates; CV storage grows an order of magnitude slower. The policy below keeps the database bounded without any admin effort, while keeping what a hiring manager actually revisits (who applied, how they scored).

| Data | Retained | Then |
|---|---|---|
| Full IP on `integrity_events` | 90 days | nulled (sweep) |
| Raw telemetry (`integrity_events` rows) and rendered item content/answer keys (`assessment_items.content/answer_key`) | 12 months after session completion | deleted / nulled (sweep). Scores, per-item summary (`assessment_results.breakdown`), integrity level and reasons are kept |
| Candidate PII and everything else | 24 months after the candidate's latest application | the whole candidate is deleted via `delete_candidate()` (sweep), **unless** any application is `hired` or has `keep_indefinitely = true` |
| CV object | with its application (above), or immediately on re-upload | purged through `cv_purge_queue` |
| Admin audit log | indefinitely (no PII) | — |

`prune_retention()` runs as step 6 of the sweep in batches of ≤ 200 candidates per hour. The privacy notice states these windows (`CANDIDATE_FLOW.md` §7). Admin tooling on top of this: per-candidate delete, **bulk archive-and-delete** (filter → CSV export → delete through the same function; `ADMIN_UX.md` §3.5), `keep_indefinitely` toggle, and a DB-size readout in Settings with a banner at 70 % of plan.
