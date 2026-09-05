# DECISIONS LOG — resolution of the review findings

Five independent reviews (`docs/reviews/01…05`) were consolidated by the coordinator into 19 material issues. Each is closed below by a change to the design documents themselves; this log records the decision and where it landed so it can be verified. Items marked **also** were reviewer findings outside the 19 that were cheap to close in the same sections and were closed.

## Product / UX

### 1. Pay and contractor status surfaced only after the PII form
**Resolution.** The landing page now carries the full structured terms card (85 ₪/h, ~18 h/week, contractor, Rishon LeZion + hybrid, immediate start), the honest tech-ops/support line, and the process outline including "the test needs a computer; the form can be filled on any device". A candidate self-selects out having given nothing. Step 2 keeps the card and the three confirmations.
**Changed.** `CANDIDATE_FLOW.md` §1 route table, new §1.1; `DESIGN_SUMMARY.md` §3 (step 0).
**Also.** Mobile expectation stated on landing (review 1 #9); Rishon "לא" acknowledged in step 2 (review 1 #7, `CANDIDATE_FLOW.md` §3); reassuring line and softened AI wording in the briefing (review 1 #4, §4); async non-blocking CV upload (review 1 #8, §2.1); form autosave note (review 1 #12, §2.1); "already completed" message now gives a date and a contact (review 1 #13, §2.2); untimed interactive practice scene before the investigation block (review 1 #5, `ASSESSMENT_DESIGN.md` §2).

### 2. Resume flow depended on email, which was off by default
**Resolution.** Two changes. (a) A **resume code** (8 chars, unambiguous alphabet, stored as SHA-256) is shown on the step-1 success screen and works at `/resume` with the email alone — no email delivery needed. (b) Transactional email is now **required at launch**: `EMAIL_ENABLED=true` is enforced by the production boot check, because closure emails (issue 3) and OTP fallback depend on it. Admins can also copy a signed 24 h resume link.
**Changed.** `CANDIDATE_FLOW.md` §1 route table, §2.2, §2.3, new §2.4, §8; `DATA_MODEL.md` §3.5 (`resume_code_hash`), §3.18 (`email_outbox`); `ARCHITECTURE.md` §1 (Email row), §6 (candidate cookie); `DEPLOYMENT.md` §1, §3, §4, §8; `ADMIN_UX.md` §4.1, §10; `OPEN_QUESTIONS.md` (former item 2 removed).

### 3. No closure for non-advancing candidates
**Resolution.** Three-point closure without personalized feedback: the done page promises a reply **by a date** (`jobs.response_window_days`, default 14) "in any case"; moving an application to נדחה queues a short non-personalized Hebrew closure email (job-level toggle, per-change checkbox); the admin list shows an "עבר מועד התשובה" counter and chip so owed replies are visible.
**Changed.** `CANDIDATE_FLOW.md` §6; `DATA_MODEL.md` §3.2 (`response_window_days`, `send_rejection_email`), §3.5 (`rejection_email_sent_at`), §3.18; `ADMIN_UX.md` §3.1, §3.2, §3.4, §3.5, §4.1, §5, §10.

## Assessment quality / hiring signal

### 4. Independence: highest weight on the fewest items
**Resolution.** Investigation block goes from 3 × 210 s to **4 × 180 s** with scenes tightened to 4–5 artifacts (12 scored judgments plus process). Weight stays 0.30 because it is the manager's top priority, with a **pre-committed fallback** (I 0.25 / T 0.30) if the pilot's split-half reliability for the block is > 0.15 below reasoning. The pilot now must compute reliability per pillar.
**Changed.** `ASSESSMENT_DESIGN.md` §2 (table, rationale paragraph), §2.2, §3.3, §4.2; `SCORING.md` §3.3 (fallback), §10 (worked example); `DATA_MODEL.md` §3.3 blueprint (`count: 4`); `TEST_STRATEGY.md` §9; `DESIGN_SUMMARY.md` §4–5. Total is now 27 items / ≈ 29:50; all "26" references updated (`ARCHITECTURE.md` §5.1, `CANDIDATE_FLOW.md` §4, `SCORING.md` §5/§8, `ANTI_CHEATING.md` §6, `TEST_STRATEGY.md`).

### 5. Process sub-score rewarded mechanical tab-clicking
**Resolution.** Redesigned around judgment: `evidence` (decisive artifact opened with ≥ 3 s dwell, 0.50), `efficiency` (decisive artifact reached within the first 2 opens = 1.0, first 3 = 0.6, later = 0.3, never = 0; 0.30), `deliberation` (an artifact opened before any answer selected, 0.20). The "≥ 3 artifacts" and "submitted" components are removed. A click-through (all tabs in < 15 s) caps efficiency at 0.3. An efficient investigator who opens two tabs now scores higher than one who cycles all five.
**Changed.** `SCORING.md` §3.3; `ASSESSMENT_DESIGN.md` §3.3 (process signal paragraph, decisive-artifact declaration); `TEST_STRATEGY.md` §2 (scoring row).

### 6. "Ask the manager is always wrong" was a one-time trick
**Resolution.** Next-action distractors are drawn per instance from a rotating pool of six anti-patterns, so no option is stable across scenes. **Escalation is sometimes correct**: in variants where the fix needs authority/money, the right answer is "report to X with the evidence and a proposed fix", while "ask the manager what to do" (no proposal) stays a distractor. The generator guarantees each session has ≥ 1 scene where escalation-with-proposal is correct and ≥ 1 where no-evidence escalation is a distractor; the bank audit checks it.
**Changed.** `ASSESSMENT_DESIGN.md` §3.3 (sub-question 2 design), worked example 6 options, §4.2, §4.4; `TEST_STRATEGY.md` §2 (generator row).

### 7. Trick/scenario exposure over a round was unaddressed
**Resolution.** Explicitly accepted as residual risk with five in-force mitigations: scenario pool grown to **12 × 3 cause variants = 36 stories** at launch (four new scenarios specified); trick rotation (issue 6); cohort-balanced scenario selection; an automatic **leakage-drift alert** (first-50 vs last-50 accuracy per scenario per job, > 25-point rise → admin banner + Sentry); and a stated cheap growth path (≈ 1 developer-day per scenario, recommended before rounds > 300 candidates — optional, not maintenance). Variant counts are now explicitly scoped to the content-collision claim only.
**Changed.** `ASSESSMENT_DESIGN.md` §3.3 scenario table, new §3.3.1, §4.3; `ARCHITECTURE.md` §10 (invariant list); `ADMIN_UX.md` §6; `DATA_MODEL.md` §3.19 (`scenario_drift` alert code).

### 8. Tech/speed items measured convention recall
**Resolution.** New bank-wide rule, **"the convention is in the item"**: any item depending on a protocol/tool semantic embeds a short statement of it (doc excerpt, legend, rule) and tests reasoning with the fact; templates declare `conventions_stated` and the bank audit fails templates that reference a convention without embedding it. Concretely: `tech.http_status_next` includes the provider's status/`Retry-After` doc excerpt (worked example 8 updated); `tech.least_privilege` → `tech.minimal_access` with an explicit permission matrix; `investigate.email_undelivered` puts the provider's verification screen and doc excerpt in the artifacts; `speed.path_resolve`, `speed.ip_valid`, `speed.regex_match`, `speed.bool_logic`, `speed.units_math` state their rules (worked example 2 updated); `speed.base_small` replaced by `speed.bracket_balance`; `speed.odd_one_out` restricted to non-trivia categories. Course-fluency families are tagged and separated in bank analytics.
**Changed.** `ASSESSMENT_DESIGN.md` §3 (rule), §3.1 table and worked example 2, §3.3 scenario table, §3.4 table and worked example 8, §4.4; `ADMIN_UX.md` §6; `TEST_STRATEGY.md` §2.

### 9. 210 s vs 180 s inconsistency
**Resolution.** **180 s** is the single value, paired with the smaller 4–5-artifact scenes so the strong-candidate need (100–150 s) keeps ≥ 15 % margin. Timing table, LLM-loop estimate, block total (12:00), session total (≈ 29:50), and integrity limits list all updated; `ASSESSMENT_DESIGN.md` now states that the seed blueprint in `DATA_MODEL.md` §3.3 is the source of truth and both agree.
**Changed.** `ASSESSMENT_DESIGN.md` §2, §2.2; `DATA_MODEL.md` §3.3; `ANTI_CHEATING.md` §4; `DESIGN_SUMMARY.md` §4.

### 10. Skipping was worse than guessing in the investigation block
**Resolution.** The "submitted" process component is removed; a skipped scene keeps whatever process credit was earned before skipping; a **blind guess** (wrong root cause with the decisive artifact never opened) is now counted as a guess regardless of timing and incurs the penalty. New invariant §3.6 "skip is never worse than a blind guess", with a 10,000-behavior property test. Briefing copy tells candidates so.
**Changed.** `SCORING.md` §3.3, §3.5, new §3.6; `TEST_STRATEGY.md` §2; `CANDIDATE_FLOW.md` §4 (rules line).

## Security / privacy / integrity

### 11. Scripted endpoint use produced zero telemetry and scored "low risk"
**Resolution.** `TELEMETRY_GAP` re-normalized (0 at ≤ 5 %, 1 at ≥ 40 %) with weight 12 **plus hard floors**: ≥ 40 % telemetry-empty items → at least סיכון גבוה; ≥ 20 % → at least סיכון בינוני. A new server-side event `telemetry_empty_item` is recorded per answer with no client events. A per-serve `item_token` (HMAC over item id + random `serve_nonce`) is required on every answer, so captured requests cannot be replayed. The threat-model table now names the scripted-endpoint case explicitly and the docs state plainly that this raises cost and guarantees detection, not prevention. A pilot participant scripts the endpoints to verify the level.
**Changed.** `ANTI_CHEATING.md` §3 (new event kinds), §4 (threat rows), §5.1 (weights + rationale), §5.3 (floors), §6; `ARCHITECTURE.md` §5.2, §6; `DATA_MODEL.md` §3.11 (`serve_nonce`); `TEST_STRATEGY.md` §2, §7, §9.
**Also.** Blur-only spans split from tab-hidden spans with lower weight and a corroboration multiplier; blur-only can never exceed low (review 3 I1). `instance_new` is always-on so paced device switches are seen (review 3 I7). Integrity pill is not sortable and the מובילים filter no longer hides flagged candidates (review 3 I2). Weights re-summed to 100.

### 12. Zero-policy RLS was not defense in depth for the service credential
**Resolution.** The app no longer uses a service-role-equivalent for data. A migration creates **`app_user`** (`NOBYPASSRLS`, explicit grants only, no `auth`/`storage` schema, no DDL, no direct DELETE on candidate tables, no direct writes to `cv_files`). Every transaction sets `app.context` / `app.application_id` / `app.admin_id` via `SET LOCAL`, and **real RLS policies** scope candidate transactions to their own application rows and require an enabled admin id for admin transactions; no context → zero rows. The service-role key is confined to signed URLs and Auth admin invites. The migration credential is documented as never being on Render. pgTAP tests assert cross-application isolation at the DB layer with the app-layer check deliberately disabled.
**Changed.** `ARCHITECTURE.md` §1, §2 (rewritten rationale), §6; `DATA_MODEL.md` header, new §6.1–6.3; `DEPLOYMENT.md` §3 (`DATABASE_URL` as `app_user`, `MIGRATION_DATABASE_URL`), §8 step 2; `TEST_STRATEGY.md` §7; `DESIGN_SUMMARY.md` §2.
**Also.** Admin MFA (TOTP) mandatory (review 3 I5): `ARCHITECTURE.md` §6, `ADMIN_UX.md` §7–8, `DEPLOYMENT.md` §7–8, `TEST_STRATEGY.md` §2. Legacy `.doc` dropped, attachment disposition (review 3 I8): `ARCHITECTURE.md` §6, `CANDIDATE_FLOW.md` §2.1, `DATA_MODEL.md` §3.9. Health endpoint no longer exposes the git SHA (review 3 M3): `DEPLOYMENT.md` §9, `ADMIN_UX.md` §7. Privacy request queue (review 3 I6): `DATA_MODEL.md` §3.20, `CANDIDATE_FLOW.md` §1/§7, `ADMIN_UX.md` §7. Secrets claim corrected for the migration credential (review 3 M1): `ARCHITECTURE.md` §6, `DEPLOYMENT.md` §3.

### 13. CV deletion depended on one blessed code path
**Resolution.** Structural guarantee: a trigger on `cv_files` (`AFTER DELETE OR UPDATE OF object_path`) enqueues the old object into `cv_purge_queue` for **any** cause — admin delete, bulk delete, retention pruning, cascade, manual SQL, or re-upload. `app_user` cannot write `cv_files` directly; the only path is `cv_upsert()` (upload first, then reference). All candidate deletions go through `delete_candidate()`. The queue is drained by the hourly sweep and by CV requests; backlog > 24 h fails the health check (UptimeRobot email) and alerts in Sentry; an on-demand reconciliation ("בדיקת קבצים") diffs the bucket against the DB. Tests cover cascade, re-upload, manual delete, Storage failure, and reconciliation.
**Changed.** `DATA_MODEL.md` §3.9 (rewritten), §6.1 (grants), §8; `ARCHITECTURE.md` §6 (Deletion), §8; `ADMIN_UX.md` §7; `DEPLOYMENT.md` §9, §11; `TEST_STRATEGY.md` §2 (CV row).

## Architecture / reliability / zero maintenance

### 14. Platform downtime silently docked candidates
**Resolution.** **Server outage credit.** A `liveness` row is touched by any request at most every 15 s. At boot (before listening) the process compares `liveness.at` with its start time; a gap > 20 s defines an outage window. `apply_outage_credit()` (`SECURITY DEFINER`, the only path the deadline-immutability trigger accepts) extends every unfinalized overlapping item's `deadline_at` by the overlap (capped at one `time_limit_s`), extends the session's `expires_at`, records `outage_credit_ms`, and writes a `server_outage` event. Integrity treats credited items as excused. The credit derives only from server-side facts, so no client input can trigger or size it; zero-downtime deploys produce no gap. Candidates see a notice; admins see the credit per item and a daily banner; Sentry is informed.
**Changed.** `ARCHITECTURE.md` §5.2 (new paragraph), §10; `DATA_MODEL.md` §3.11 (`outage_credit_ms`, exception text), §3.17 (`liveness`, `maintenance`); `ANTI_CHEATING.md` §3, §5.2, §6; `SCORING.md` §8; `CANDIDATE_FLOW.md` §8; `DEPLOYMENT.md` §10 (boot sequence, SIGTERM drain — also closes review 4 #7); `TEST_STRATEGY.md` §2 (outage row).

### 15. Retention promises depended on optional `pg_cron`/`pg_net`
**Resolution.** No optional extension is used anywhere. The **hourly sweep runs inside `/api/health`**, which Render calls every 30 s (and UptimeRobot every 5 min) for the life of the service; a `maintenance.last_sweep` row is the lock so exactly one caller per hour runs it. IP nulling is therefore guaranteed within 90 days + 1 hour, unconditionally, and the health check itself reports sweep age (> 3 h → 503 → alert). The admin digest is removed and replaced by list-header counters. `DEPLOYMENT.md` states explicitly that `pg_cron`/`pg_net` are not used.
**Changed.** `ARCHITECTURE.md` §1 (Maintenance sweeps row), §8 (rewritten, sweep paragraph + table); `DATA_MODEL.md` §3.17, §8; `ADMIN_UX.md` §10; `DEPLOYMENT.md` §5 (extensions), §9; `TEST_STRATEGY.md` §2 (sweep row), §8 (Scenario E).

### 16. No alerting layer
**Resolution.** Three always-on channels, all free and configured once: **Sentry required in production** (boot refuses without `SENTRY_DSN`; "new issue" alert rule emails `ALERT_EMAIL`), **UptimeRobot** on `/api/health` (which now returns 503 for migration mismatch, sweep staleness, or purge backlog), and Render deploy/health notifications. The sweep runs **invariant checks** — template accuracy outside [10 %, 95 %], expiry among strong candidates, scenario leakage drift, purge backlog, email failures, DB size > 70 %, outage credits — each producing an `admin_alerts` banner and a Sentry warning. A plain-language runbook tells the hiring manager what each email means. Dependabot security alerts are on (alerts only).
**Changed.** `ARCHITECTURE.md` §1 (Alerting row), §3 (topology), §10 (rewritten); `DATA_MODEL.md` §3.19; `ADMIN_UX.md` §3.0, §6, §7; `DEPLOYMENT.md` §1, §3 (`SENTRY_DSN`, `ALERT_EMAIL`), §4, §8 steps 6/9/10, §9, §13, new §14; `TEST_STRATEGY.md` §2 (alerts row).
**Also.** Backup restore drill before launch (review 4 #9): `DEPLOYMENT.md` §8 step 12, §11, `TEST_STRATEGY.md` §9. Migration expand/contract rule with a CI check (review 4 #5): `DEPLOYMENT.md` §5, §13. "What still needs a developer" stated plainly (review 4 #6): `ARCHITECTURE.md` §8, `ADMIN_UX.md` §5, `DESIGN_SUMMARY.md` §2.

### 17. Node 20 aging; dependency tooling disabled
**Resolution.** Runtime baseline is **Node 22 LTS** (maintained until April 2027), pinned in `package.json`/`.node-version`. One bounded maintenance exception is stated plainly wherever "zero maintenance" is claimed: **a half-day annual developer session** (calendar reminder to the manager) to bump Node to current LTS, update dependencies, run CI, deploy, and repeat the restore drill. GitHub Dependabot *security alerts* are enabled (alerts only, no auto-PRs); Renovate stays off.
**Changed.** `ARCHITECTURE.md` §1, §3, §8 (Dependency/runtime row); `DEPLOYMENT.md` §1, §4, §8 step 13, §10, §13, §14; `DESIGN_SUMMARY.md` §2; `OPEN_QUESTIONS.md` (transparency list).

## Performance / cost

### 18. Pool of 5 undersized for a synchronized start burst
**Resolution.** App-side pool raised to **20** (Supavisor transaction mode; steady state needs ~2). Rationale rewritten around the burst case, with a stated target (p95 time-to-first-item < 500 ms at 150 simultaneous starts). New k6 **Scenario D** fires 150 full sign-up → start → first-item sequences within 10 s and asserts latency, zero pool-wait timeouts, RSS < 300 MB, no GC pause > 200 ms, and that `served_at` is never set materially before the payload leaves the server; Scenario E runs the sweep under that load. The "~40 ms" transition claim is replaced with a realistic 80–150 ms end-to-end figure; a bundle budget is added for the top-of-funnel pages (≤ 60 KB gzipped, job description pre-rendered to HTML).
**Changed.** `ARCHITECTURE.md` §5.2, §5.3, §7; `DEPLOYMENT.md` §10; `DATA_MODEL.md` §3.2 (`description_html`); `TEST_STRATEGY.md` §8 (Scenarios A, D, E), §2 (bundle note unchanged for the runner).
**Also.** `percent_rank()` claim scoped to the stated volumes with a named fallback (review 5 #4): `DATA_MODEL.md` §3.14. Resend cost line added (review 5 #7): `DEPLOYMENT.md` §1, `ADMIN_UX.md` §10. Institution filter list cached (review 5 #8): `ADMIN_UX.md` §3.3.

### 19. Unbounded retention with no bulk path
**Resolution.** Growth quantified (≈ 150–250 KB per completed candidate; ~8 GB at 30–40k) and a **bounded retention policy** adopted, enforced by the sweep: full IP 90 days; raw telemetry and rendered item content/keys 12 months after completion (scores, breakdown, integrity level and reasons kept); the whole candidate record 24 months after the latest application unless `hired` or flagged `keep_indefinitely`. The privacy notice states these windows. Admin tooling: **bulk archive-and-delete** (filter → CSV export → `delete_candidate()` in batches, excluding hired/kept rows), a keep-forever toggle, and DB size vs. plan in Settings with a 70 % banner and Sentry warning.
**Changed.** `DATA_MODEL.md` §3.5 (`keep_indefinitely`), §3.11 (nullable content), §8 (rewritten); `CANDIDATE_FLOW.md` §7 (privacy notice); `ADMIN_UX.md` §3.5, §4.1, §7; `ARCHITECTURE.md` §8, §10; `DEPLOYMENT.md` §1; `TEST_STRATEGY.md` §2 (sweep and bulk rows); `DESIGN_SUMMARY.md` §6.

## Reviewer findings considered and deliberately not changed
- **Speed pace leaking across blocks** (review 2 #9): kept as a whole-assessment tempo measure; it is documented as such, carries only 15 %, counts correct answers only, and the accuracy gate prevents it from rewarding haste. Revisit after the pilot if Speed variance is dominated by investigation-item timing.
- **Hard 60 % accuracy gate** (review 2 #14): kept; the gate only affects the Speed pillar (15 % of Overall), and a one-item swing near the boundary moves Overall by ≤ 3 points. A taper would add a parameter with no data behind it.
- **Full date of birth** (review 3 I4): kept because the business requirements mandate date of birth as a required field; mitigated by never using it in scoring, displaying age, and purging it under the 24-month retention rule.
- **Single instance, single region** (review 4 #10–11): kept; the runbook now tells the manager what a Render outage email looks like, and status-page subscriptions are a setup step.
