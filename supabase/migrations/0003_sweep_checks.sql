-- 0003_sweep_checks.sql
--
-- Wires the 4 sweep invariant checks that IMPLEMENTATION_NOTES.md left as
-- TODOs in run_maintenance_sweep() (0001_init.sql §7.7), blocked at the time
-- on assessment bank / results data that didn't exist yet:
--
--   1. template_accuracy       — a template family's accuracy over its last
--                                 50 served instances falls outside [10%, 95%]
--                                 (ARCHITECTURE.md §10, bullet 1).
--   2. template_expiry_strong  — a template family's expiry rate among
--                                 candidates scoring >= 65 overall exceeds 35%
--                                 (ARCHITECTURE.md §10, bullet 2).
--   3. scenario_drift          — an investigation scenario's accuracy rose by
--                                 > 25 points between its first 50 and most
--                                 recent 50 servings within a job
--                                 (ARCHITECTURE.md §10, bullet 3;
--                                 ASSESSMENT_DESIGN.md §3.3.1 mitigation #4).
--   4. outage_credit           — sessions credited for server downtime in the
--                                 last 24h, so the admin knows an outage
--                                 happened and who was credited
--                                 (ARCHITECTURE.md §10, bullet 6).
--
-- The other two invariant checks named in ARCHITECTURE.md §10 (cv_purge_backlog,
-- email_failures) were already implemented in 0001_init.sql and are
-- reproduced here unchanged, since `create or replace function` replaces the
-- whole function body — there is no way to "append" to a SQL function.
-- db_size (the 6th/7th item some readings of §10 count separately) is left
-- alone: it isn't blocked on bank/results data (pg_database_size needs
-- nothing this migration adds) and Settings-page threshold display is
-- explicitly the admin-ui engineer's territory per IMPLEMENTATION_STATE.md.
--
-- Per DATA_MODEL.md §3.19, admin_alerts.code is a free-text column (no CHECK
-- constraint enumerating values), so no schema change is needed to introduce
-- these new codes — only the function body changes.
--
-- Sample-size thresholds ("at least N servings before judging a rate") are
-- not specified numerically in the docs beyond the "last 50" / "first 50 vs
-- last 50" framing itself; this migration requires at least 50 (accuracy),
-- 20 (expiry-among-strong — a smaller, reasonable floor since "strong
-- candidate" sessions are a subset of all sessions), and 100 (drift, so the
-- first-50 and last-50 windows are disjoint) samples before alerting, so a
-- brand-new template/scenario never fires on noise.

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

  update maintenance set db_size_bytes = pg_database_size(current_database()), db_size_at = now();

  return true;
end $$;
