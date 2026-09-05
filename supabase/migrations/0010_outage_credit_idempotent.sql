-- 0010_outage_credit_idempotent.sql
-- Red-team finding #4 (CRITICAL, data-integrity, cross-process):
-- `apply_outage_credit()` was not idempotent/race-safe across multiple
-- server processes. `ensureOutageBootCheckRan()` (src/lib/outage-boot-check.ts)
-- only memoizes *per process* (`let ranOnce`); if two instances (a stuck old
-- instance during a deploy, a manual scale-up) both observe the same stale
-- `liveness.at` before either has updated it, both independently call
-- `apply_outage_credit()` with windows that share the same start
-- (`liveness.at`, unread by either yet) and nearly-identical ends (each
-- instance's own `Date.now()`), typically only milliseconds apart. Because
-- each item's per-call credit is capped at `time_limit_s * 1000` ms
-- (0001_init.sql §7.4's `least(..., r.time_limit_s * 1000)`), once the
-- outage genuinely covers an item's whole remaining window that cap
-- saturates identically in *both* calls — so both calls credit the exact
-- same full time_limit_s again, doubling it (verified: one item got 60s of
-- credit against a 30s time_limit_s — exactly 2x the intended one-time cap).
--
-- Fixed with two changes to `apply_outage_credit()` itself, so it is safe
-- regardless of how many processes call it, without relying on
-- `ensureOutageBootCheckRan()`'s per-process memoization at all:
--
--   1. `pg_advisory_xact_lock` on a fixed key serializes *all* concurrent
--      calls to this function (it's rare and cheap — boot-time only — so
--      full serialization has no real cost). This closes the true-
--      concurrency race: without it, two calls running at the literal same
--      instant would both pass a "was this already credited?" check before
--      either had committed its rows.
--   2. Per-item idempotency via the very `integrity_events` rows the
--      function already inserts (`kind = 'server_outage'`): an item is only
--      eligible for a new credit if it does NOT already have a
--      `server_outage` event whose *recorded* window overlaps the window
--      being applied now. This is robust to the realistic case above (two
--      calls with the same start but slightly different ends — the windows
--      still overlap, so the second call correctly sees "already credited"
--      and skips it) while still crediting a genuinely later, non-
--      overlapping outage normally.

create or replace function apply_outage_credit(p_window_start timestamptz, p_window_end timestamptz)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_overlap_ms integer;
  v_count integer := 0;
  r record;
begin
  -- Serialize all calls (see comment above) — held for the rest of this
  -- transaction, released automatically on commit/rollback.
  perform pg_advisory_xact_lock(hashtext('apply_outage_credit'));

  perform set_config('app.outage_credit', 'on', true);

  for r in
    select i.id, i.session_id, i.served_at, i.deadline_at, i.time_limit_s
    from assessment_items i
    where i.finalized_at is null
      and i.served_at is not null
      and i.deadline_at is not null
      and i.served_at < p_window_end
      and i.deadline_at > p_window_start
      -- Idempotency guard: skip items already credited for a window that
      -- overlaps this one (see migration comment above).
      and not exists (
        select 1 from integrity_events ie
        where ie.item_id = i.id
          and ie.kind = 'server_outage'
          and (ie.meta->>'window_start')::timestamptz < p_window_end
          and (ie.meta->>'window_end')::timestamptz > p_window_start
      )
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
