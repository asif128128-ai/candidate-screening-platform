-- 0005_assessment_runner_support.sql
-- Additive-only (DEPLOYMENT.md §5 expand/contract rule). Two nullable
-- columns on assessment_sessions needed by the hot-path runner
-- (ARCHITECTURE.md §5.2, ANTI_CHEATING.md §3) to detect `ip_change` and
-- `clock_anomaly` across requests within a session:
--   - `last_ip_prefix`: the truncated (/24 or /48) IP prefix seen on the
--     most recent request, NOT the full IP (ARCHITECTURE.md §6 PII
--     minimisation: full IP is only ever kept, temporarily, on
--     `integrity_events` rows themselves — see prune_retention()). Storing
--     only the prefix here means this column needs no retention pruning of
--     its own.
--   - `last_skew_ms`: the most recently measured client/server clock skew,
--     so a jump > CLOCK_ANOMALY_THRESHOLD_MS (timing.ts) between two
--     requests can be detected without a separate events query per request.
alter table assessment_sessions
  add column if not exists last_ip_prefix text,
  add column if not exists last_skew_ms integer;
