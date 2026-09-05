-- 0011_db_size_sweep_check.sql
-- Red-team finding #9 (IMPORTANT): `run_maintenance_sweep()`'s own comment
-- admitted `db_size` was "left alone" — it wrote `maintenance.db_size_bytes`
-- every sweep but never compared it against a threshold or raised an
-- `admin_alerts` row, unlike the other 5 invariant checks (cv_purge_backlog,
-- email_failures, template_accuracy, template_expiry_strong,
-- scenario_drift). A solo operator who never opens the admin Settings page
-- (which computes this live from the same column — src/app/admin/
-- (protected)/layout.tsx, src/lib/admin-format.ts's `dbSizeFraction`/
-- `DB_SIZE_WARNING_FRACTION`) would never know the database is approaching
-- its plan limit.
--
-- Fixes this by adding the missing check, following the exact
-- insert-into-admin_alerts pattern the other 5 already use, at the same 70%
-- threshold and 8 GiB plan size src/lib/admin-format.ts's
-- `DB_PLAN_BYTES`/`DB_SIZE_WARNING_FRACTION` already use for the Settings-
-- page banner (kept in sync by literal value — SQL has no way to import a
-- TypeScript constant; if that constant ever changes, this literal needs
-- updating alongside it, same as ANTI_CHEATING.md-derived thresholds
-- elsewhere in this function already are). Severity graduates to
-- 'critical' at 90%, matching the layout's own critical/warning split.
--
-- The db_size check itself is factored into its own SECURITY DEFINER
-- function, `evaluate_db_size_alert(bigint)`, taking the size explicitly
-- rather than calling `pg_database_size()` inline — this is what lets a
-- test exercise both sides of the 70%/90% thresholds directly (with a
-- synthetic byte count) without needing a real multi-GB database.
-- `run_maintenance_sweep()` still calls it with the real
-- `pg_database_size(current_database())`, same as before.
--
-- `create or replace function` replaces the whole body, so this migration
-- reproduces run_maintenance_sweep() in full (unchanged apart from the new
-- check at the end), same as 0003_sweep_checks.sql did for the same reason.

create or replace function evaluate_db_size_alert(p_db_size_bytes bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_db_plan_bytes constant bigint := 8589934592; -- 8 GiB, src/lib/admin-format.ts DB_PLAN_BYTES
  v_db_warning_fraction constant numeric := 0.7;  -- src/lib/admin-format.ts DB_SIZE_WARNING_FRACTION
  v_db_critical_fraction constant numeric := 0.9; -- matches the layout's own critical/warning split
begin
  if p_db_size_bytes >= (v_db_plan_bytes * v_db_warning_fraction) then
    insert into admin_alerts (code, severity, message_he, meta)
    values (
      'db_size',
      case when p_db_size_bytes >= (v_db_plan_bytes * v_db_critical_fraction) then 'critical' else 'warning' end,
      'מסד הנתונים ב-' || round(100 * p_db_size_bytes / v_db_plan_bytes::numeric) || '% מהמכסה',
      jsonb_build_object('key', 'db_size', 'db_size_bytes', p_db_size_bytes, 'db_plan_bytes', v_db_plan_bytes)
    )
    on conflict (code, (meta->>'key')) do update
      set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he,
          severity = excluded.severity;
  else
    -- Below threshold again (e.g. after retention pruning shrank the DB) —
    -- clear a previously-raised alert rather than leaving a stale one
    -- around forever, matching how every other check here is naturally
    -- self-clearing (their own WHERE/HAVING simply stops matching).
    delete from admin_alerts where code = 'db_size' and (meta->>'key') = 'db_size';
  end if;
end $$;

create or replace function run_maintenance_sweep() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  won_lock boolean;
  v_db_size_bytes bigint;
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

  -- (7) invariant checks -> admin_alerts rows (ARCHITECTURE.md §10).

  -- cv_purge_backlog (unchanged from 0001_init.sql)
  insert into admin_alerts (code, severity, message_he, meta)
  select 'cv_purge_backlog', 'critical',
         'תור מחיקת קבצים תקוע: ' || count(*) || ' קבצים ממתינים מעל 24 שעות',
         jsonb_build_object('key', 'cv_purge_backlog', 'count', count(*))
  from cv_purge_queue
  where enqueued_at < now() - interval '24 hours'
  having count(*) > 0
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  -- email_failures (unchanged from 0001_init.sql)
  insert into admin_alerts (code, severity, message_he, meta)
  select 'email_failures', 'warning',
         count(*) || ' מיילים נכשלו יותר מ-3 פעמים',
         jsonb_build_object('key', 'email_failures', 'count', count(*))
  from email_outbox
  where sent_at is null and attempts > 3
  having count(*) > 0
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  -- template_accuracy: accuracy over each template's last 50 served
  -- instances (across all jobs — a template family is shared bank content,
  -- not job-specific) outside [10%, 95%]. is_correct on assessment_responses
  -- is the item's headline correctness (for investigation items, sub-question
  -- 1 / root cause — see src/assessment/scoring.ts).
  insert into admin_alerts (code, severity, message_he, meta)
  select 'template_accuracy', 'warning',
         'תבנית "' || t.template_id || '" עם דיוק ' || round(t.accuracy * 100) ||
           '% על 50 ההגשות האחרונות — מחוץ לטווח התקין (10%-95%), ייתכן מפתח תשובה שבור או תוכן שדלף',
         jsonb_build_object('key', t.template_id, 'template_id', t.template_id, 'accuracy', t.accuracy, 'n', t.n)
  from (
    select ranked.template_id,
           avg(case when resp.is_correct then 1.0 else 0.0 end) as accuracy,
           count(*) as n
    from (
      select i.id, i.template_id,
             row_number() over (partition by i.template_id order by i.served_at desc) as rn
      from assessment_items i
      where i.served_at is not null
    ) ranked
    join assessment_responses resp on resp.item_id = ranked.id
    where ranked.rn <= 50
    group by ranked.template_id
    having count(*) >= 50
  ) t
  where t.accuracy < 0.10 or t.accuracy > 0.95
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  -- template_expiry_strong: expiry rate among candidates scoring >= 65
  -- overall exceeds 35% — the timer, not ability, is binding for the best
  -- candidates (ASSESSMENT_DESIGN.md §2.2's ongoing guard).
  insert into admin_alerts (code, severity, message_he, meta)
  select 'template_expiry_strong', 'warning',
         'תבנית "' || x.template_id || '" עם שיעור פקיעה ' || round(x.expiry_rate * 100) ||
           '% בקרב מועמדים חזקים (ציון כולל 65+) — ייתכן שהזמן הקצוב, ולא היכולת, הוא הגורם המגביל',
         jsonb_build_object('key', x.template_id, 'template_id', x.template_id, 'expiry_rate', x.expiry_rate, 'n', x.n)
  from (
    select i.template_id,
           avg(case when i.status = 'expired' then 1.0 else 0.0 end) as expiry_rate,
           count(*) as n
    from assessment_items i
    join assessment_sessions s on s.id = i.session_id
    join assessment_results r on r.session_id = s.id
    where r.score_overall >= 65
    group by i.template_id
    having count(*) >= 20
  ) x
  where x.expiry_rate > 0.35
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  -- scenario_drift: an investigation scenario's accuracy rose by > 25 points
  -- between its first 50 and most recent 50 servings WITHIN A JOB (word-of-
  -- mouth leakage signal — ASSESSMENT_DESIGN.md §3.3.1 mitigation #4). Scoped
  -- per job because leakage is a round-specific phenomenon; scoped to
  -- investigate.* template ids because only investigation scenes have the
  -- "cause variant" exposure risk this check is meant to catch. Requires at
  -- least 100 servings so the first-50 and last-50 windows never overlap.
  insert into admin_alerts (code, severity, message_he, meta)
  select 'scenario_drift', 'warning',
         'תרחיש "' || d.template_id || '" במשרה מציג עלייה של ' || round((d.recent_acc - d.first_acc) * 100) ||
           ' נקודות דיוק בין ההגשות הראשונות לאחרונות — חשד לדליפת מידע על התרחיש בסבב הנוכחי',
         jsonb_build_object('key', d.job_id::text || ':' || d.template_id, 'job_id', d.job_id,
                             'template_id', d.template_id, 'first_accuracy', d.first_acc, 'recent_accuracy', d.recent_acc)
  from (
    select job_id, template_id,
           avg(case when rn_asc <= 50 then (case when is_correct then 1.0 else 0.0 end) end) as first_acc,
           avg(case when rn_desc <= 50 then (case when is_correct then 1.0 else 0.0 end) end) as recent_acc,
           max(total_n) as n
    from (
      select r.job_id, i.template_id, resp.is_correct,
             row_number() over (partition by r.job_id, i.template_id order by i.served_at asc) as rn_asc,
             row_number() over (partition by r.job_id, i.template_id order by i.served_at desc) as rn_desc,
             count(*) over (partition by r.job_id, i.template_id) as total_n
      from assessment_items i
      join assessment_sessions s on s.id = i.session_id
      join assessment_results r on r.session_id = s.id
      join assessment_responses resp on resp.item_id = i.id
      where i.template_id like 'investigate.%' and i.served_at is not null
    ) servings
    group by job_id, template_id
    having max(total_n) >= 100
  ) d
  where (d.recent_acc - d.first_acc) > 0.25
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  -- outage_credit: sessions credited for a server outage in the last 24h
  -- (an excusal, shown informationally — never a risk signal).
  insert into admin_alerts (code, severity, message_he, meta)
  select 'outage_credit', 'info',
         count(distinct ie.session_id) || ' מפגשים קיבלו זיכוי זמן עקב תקלת שרת ב-24 השעות האחרונות',
         jsonb_build_object('key', 'last_24h', 'sessions', count(distinct ie.session_id))
  from integrity_events ie
  where ie.kind = 'server_outage'
    and ie.created_at > now() - interval '24 hours'
  having count(*) > 0
  on conflict (code, (meta->>'key')) do update
    set last_seen_at = now(), meta = excluded.meta, message_he = excluded.message_he;

  v_db_size_bytes := pg_database_size(current_database());
  update maintenance set db_size_bytes = v_db_size_bytes, db_size_at = now();

  -- db_size: the 6th invariant check, previously unimplemented (this
  -- migration's whole purpose) — mirrors the Settings-page banner
  -- (src/lib/admin-format.ts) so crossing 70% surfaces even to an operator
  -- who never opens that page.
  perform evaluate_db_size_alert(v_db_size_bytes);

  return true;
end $$;

grant execute on function evaluate_db_size_alert to app_user;
