-- 0009_scope_outbox_ratelimit_rls.sql
-- Red-team finding #3 (CRITICAL): `email_outbox_any` and `rate_limit_any`
-- (0001_init.sql) granted `candidate` context unrestricted read/write over
-- the *entire* table, unlike every other candidate-facing table in this
-- schema. A connection in `candidate` context (the same context every
-- candidate-facing request uses) could:
--   - read every row of `email_outbox`, including `resume_otp` rows whose
--     `payload` contains a plaintext OTP login code for *any* candidate's
--     application, not just its own;
--   - delete or modify any `rate_limits` row, e.g. clearing another
--     applicant's signup/resume/OTP lockout, or anyone's.
--
-- Investigated (per the task's instruction) which code paths actually touch
-- these tables from `candidate` context before choosing a fix
-- (`grep -rn "rate_limits\|email_outbox" src/`):
--   - `consumeRateLimit()` (src/lib/rate-limit.ts) is called from
--     src/app/(candidate)/[locale]/{jobs/[slug]/apply,resume,privacy}/actions.ts
--     — every one of those call sites runs inside `withSystem(...)`, never
--     `withCandidate(...)`. No legitimate candidate-context code path
--     queries `rate_limits` directly.
--   - `enqueueEmail()`/`sendQueuedEmailBestEffort()` (src/lib/email/send.ts)
--     are likewise only ever called from `withSystem(...)` transactions
--     (src/db/queries/application-flow.ts's `submitPersonalDetails` and
--     `requestOtp`), and from `withAdmin(...)` (candidate-mutations.ts's
--     `changeStage`). No legitimate candidate-context code path touches
--     `email_outbox` directly either.
--
-- So, per the task's own guidance ("deny all direct candidate-context
-- access if no legitimate candidate-context code path actually needs it"),
-- both policies are narrowed to the same `system`/`admin` shape every other
-- admin-only utility table already uses (`admin_only` on `admin_notes` etc.)
-- — candidate context loses all access to both tables, which changes
-- nothing observable for real candidates (they never went through
-- `candidate` context to reach these tables in the first place) while
-- closing the cross-candidate read/write hole.

drop policy if exists email_outbox_any on email_outbox;
create policy email_outbox_any on email_outbox for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));

drop policy if exists rate_limit_any on rate_limits;
create policy rate_limit_any on rate_limits for all to app_user
  using (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()))
  with check (app_ctx() = 'system' or (app_ctx() = 'admin' and app_is_admin()));
