-- 0003_resume_otp.sql
--
-- CANDIDATE_FLOW.md §2.4 / DECISIONS_LOG.md #2: re-entry works two ways —
-- (a) the resume code (`applications.resume_code_hash`, already in
-- 0001_init.sql) which needs no email delivery, and (b) an email OTP
-- fallback. DATA_MODEL.md never defined storage for the OTP itself (no
-- dedicated table, no columns) — this is the smallest additive fix: two
-- nullable columns on `applications`, mirroring how `resume_code_hash` is
-- stored (hash only, never the plaintext code). Expand-only migration per
-- ARCHITECTURE.md §16's migration expand/contract rule; nothing existing
-- changes shape. See IMPLEMENTATION_NOTES.md "OTP storage" for the full
-- reasoning, including why one candidate's OTP targets their single most
-- recent application rather than trying to disambiguate multiple jobs.

alter table applications
  add column if not exists otp_code_hash bytea,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_attempts smallint not null default 0;
