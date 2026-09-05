# TEST STRATEGY

Status: **Decided.** To be executed by the implementation team. Tools are fixed to the stack: **Vitest** (unit/integration), **Playwright** (real browser e2e, Chromium + Firefox + WebKit), **pgTAP** via `supabase test db` (DB invariants/RLS), **k6** (load), **axe-core** via Playwright (accessibility), **Percy-free visual snapshots** via Playwright `toHaveScreenshot` for RTL layouts.

Coverage targets: `assessment/*` pure modules 100 % branch; server actions/routes ≥ 85 %; e2e covers every requirement row in §2.

## 1. Test layers

| Layer | Tool | Runs where | Scope |
|---|---|---|---|
| Unit | Vitest | CI, every PR | generators, scoring, integrity, timing, normalizers, validators |
| Bank audit | custom script (Vitest reporter) | CI, every PR | 20,000 generated sessions; invariants in `ASSESSMENT_DESIGN.md` §4.4 |
| Integration | Vitest + Supabase local (Docker) | CI | server actions and route handlers against a real Postgres; transactions, triggers, storage |
| DB | pgTAP | CI | RLS deny-all, triggers (`served_once`, `deadline_immutable`, `results_immutable`), cascades, unique constraints |
| E2E | Playwright | CI (Chromium smoke on PR; full matrix nightly + before release) | candidate flow, assessment runner, timers, recovery, admin |
| Load | k6 | before launch; on demand | concurrent assessment sessions; admin list at scale |
| Accessibility | axe-core in Playwright | CI | candidate + admin pages |
| Security | pgTAP + Playwright + manual checklist | CI + pre-launch | boundaries in §7 |

Time control: the server exposes a test-only clock (`TEST_CLOCK_OFFSET_MS` env, refused in production) so e2e tests can move time forward without waiting real seconds; unit tests inject `now()`.

## 2. Requirement → test map

| Requirement | Tests |
|---|---|
| Candidate flow steps 1–3, ordering, resume | E2E `candidate/flow.spec.ts`: complete happy path; reload at every step; direct URL to later step redirects; earlier step shows summary |
| Personal-details validation/normalization | Unit `lib/normalize.test.ts` (phone variants → E.164, email lowercasing, URL normalization, average range, DOB bounds); E2E form errors in Hebrew, focus management |
| Duplicate signals | Integration: same email+job resumes (OTP path), same email other job pre-fills, same phone flags `duplicate_phone_of`; never blocks |
| Average not auto-rejecting; DOB not in scoring | Unit: `scoreSession` signature has no candidate fields (type-level test with `expectTypeOf`); integration: candidate with average 60 reaches assessment and gets scored identically to average 95 with the same seed and answers |
| Job description confirmation | E2E: continue button disabled until 3 checkboxes; `job_confirmed_at` set |
| Assessment structure (27 items, blocks, order) | Unit `generator.test.ts`: blueprint honored, no family repeats, difficulty mix, option shuffle, determinism by seed, investigation escalation constraints per session, scenario cohort balance, `conventions_stated` text present in rendered content |
| Strict per-question timers | Integration `timing.test.ts`: `served_at` set once; second `GET /current` returns same `deadline_at`; answer at `deadline+1.9s` accepted with `late_by_ms`; at `deadline+2.1s` recorded expired; answer for non-current item rejected 409; answer without a valid `item_token` rejected 401; a captured answer request replayed for the next item rejected |
| Server outage credit | Integration `outage.test.ts`: stale `liveness` + boot → items overlapping the window get `deadline_at` extended by the overlap (capped at `time_limit_s`), `outage_credit_ms` set, `server_outage` event written, session `expires_at` extended; items outside the window untouched; a second boot with a fresh `liveness` grants nothing; the immutability trigger rejects any `deadline_at` change outside `apply_outage_credit()`; integrity excludes credited items from `HIDDEN_THEN_CORRECT_LATE`/`IMPOSSIBLE_TIMING`; E2E: kill the dev server mid-item for 30 s (test harness), restart, the runner shows the extension notice and the timer reflects it |
| Hourly sweep (no cron) | Integration `sweep.test.ts`: only one of 20 concurrent health calls wins the lock; IP nulling at 90 days; rate-limit cleanup; CV purge-queue drain with Storage mock (success removes queue row, failure increments `attempts`); abandoned-session finalization; retention pruning (12-month telemetry/content, 24-month candidate delete, `hired`/`keep_indefinitely` exempt); invariant checks create `admin_alerts` rows and call Sentry once per new condition; a sweep is bounded to 2 s |
| Resume / re-entry without email | E2E: clear cookies, `/resume` with email + resume code restores the session at the current step with the original deadline; wrong code 5× → rate limited; OTP path also works; admin-generated resume link works once and expires |
| Closure | Integration: done page shows the response date from `response_window_days`; stage → `rejected` queues the closure email unless unticked or the job disables it; `rejection_email_sent_at` set after send; overdue chip/counter appear after the window passes |
| Refresh/reconnect does not reset timer | E2E: reload mid-item, timer continues from server deadline; kill network (Playwright `context.setOffline`) during submit, restore, answer persisted once; item expiring during outage recorded as expired with `network_retry` event |
| No backward navigation | E2E: browser back stays on current item; no API to fetch previous items (integration: `GET /item/{prev}` → 404) |
| Skip behavior | Unit scoring: skip = 0, not negative; E2E skip advances |
| Scoring per pillar, overall, bands, confidence | Unit `scoring.test.ts`: the worked example in `SCORING.md` §10 reproduces exactly; property tests: monotonic in correctness; speed capped at 50 when accuracy < 0.6; pace ignores wrong answers; guess penalty bounds; confidence math for abandoned sessions; **process score**: efficiency credit by open ordinal, click-through rule (< 15 s all tabs → 0.3), dwell < 3 s does not count as an open; **`skip_dominates_blind_guess`** over 10,000 random behaviors |
| Percentile | Integration: window function over seeded results; confidence < 0.6 excluded |
| Integrity signals and risk | Unit `integrity.test.ts`: each signal's normalization; hidden vs blur-only split and the corroboration multiplier; excusals (network/outage overlap, ≤ 3 s hidden); thresholds; **floors** (≥ 40 % telemetry-empty → high; ≥ 20 % → medium; any `instance_conflict` → medium; blur-only alone never above low); a fully scripted session (zero client events, plausible timing) lands at high; reasons text and evidence positions; E2E: real `visibilitychange`/`blur` in Chromium produce events; copy/paste blocked and logged; `instance_new` on every new context, `instance_conflict` when two contexts hit the same session concurrently, none when a reload happens after > 30 s |
| Session recovery / wall clock | Integration: session past `expires_at` becomes `abandoned` on read; results computed with reduced confidence |
| Admin auth | E2E: login, wrong password, disabled admin blocked with Hebrew message, non-allowlisted auth user blocked, **no TOTP enrolled → forced to enroll, data pages 302**, `aal1` session rejected on data pages, session persists across reload, logout; middleware unit tests for JWT verification, `aal2` and allowlist |
| Bulk archive-and-delete / retention | Integration: filter selection exports CSV then deletes through `delete_candidate()`; `hired` and `keep_indefinitely` rows skipped and reported; CV paths land in the purge queue; audit rows without PII; interrupted run leaves a consistent state |
| Multi-admin | Integration: add admin from settings creates row + invite; cannot disable self |
| Candidate list at scale | Load/integration: seed 5,000 applications + results; list p95 server time < 150 ms for default sort and for 3 filter combos; keyset pagination stable under inserts |
| Candidate detail | E2E: all fields rendered, CV download via signed URL (expires), stage change writes history, notes CRUD, integrity timeline renders 27 segments incl. outage band and telemetry-empty outline, item click shows rendered item with candidate answer |
| Landing / terms-first | E2E: terms card, tech-ops line, "computer needed" line and process steps are visible on `/jobs/{slug}` before any input; 390 px viewport shows the same |
| Admin alerts | Integration: each invariant (template accuracy out of range, strong-candidate expiry, scenario drift, purge backlog, email failures, DB size, outage credit) creates one `admin_alerts` row, re-seen updates `last_seen_at`, dismissal hides it until the condition recurs; banner renders on the list |
| Job creation/editing | E2E: create job, preview inactive job as admin, activate, apply as candidate, deactivate mid-flow lets in-flight candidate finish and blocks new visits; delete blocked when applications exist |
| Assessment config relation | Integration: new job defaults to `default_tech_student_v1`; session stores `config_version`; changing job config affects only new sessions |
| CV handling | Integration: PDF/DOCX accepted by magic bytes; `.doc`, renamed `.exe`, SVG/HTML → rejected; > 5 MB rejected; object path is UUID; `app_user` cannot INSERT/UPDATE `cv_files` directly (permission denied), only via `cv_upsert`; **re-upload enqueues the old path** (trigger); **cascade delete enqueues** (trigger); manual `DELETE FROM candidates` as owner enqueues; drain removes objects; a Storage failure leaves the queue row with `attempts+1` and the DB row already gone (never an orphan without a queue entry); reconciliation lists an object planted directly in the bucket; download served as attachment with validated MIME |
| Privacy/consent/deletion | Integration: consents rows with text version; delete cascades everything; audit row without PII |
| Hebrew RTL | Playwright screenshots (RTL layouts on 3 browsers) for: step 1 form, job card, each item kind, investigation tabs, admin list, candidate detail; assertions on `dir="rtl"`, LTR inputs, `<bdi>` around numbers; lint rule test fails on `ml-`/`pl-` utilities |
| Performance-sensitive flows | k6 §8; Playwright timing: item transition < 300 ms p95 on local stack; bundle size budget test (runner route JS ≤ 120 KB gzipped) |
| Security boundaries | §7 |
| Health check and deploy | Integration: `/api/health` 503 on migration mismatch; 200 otherwise |
| i18n readiness | Unit: every key in `he.json` referenced; missing `en` falls back to `he` without throwing |

## 3. Unit tests — specifics
- `generator.test.ts`: 1,000 seeds → all invariants; snapshot of 50 seeds' content (guards accidental template drift); `template.score(key.answer)` = 1 for every generated item; distractors < 1.
- Per template: a `*.test.ts` next to each template with 3–5 hand-checked instances (e.g. the worked examples in `ASSESSMENT_DESIGN.md` must be reproducible from documented seeds).
- `timing.test.ts`: deadline math, grace, skew correction, DST edge (Israel clock change) — server uses UTC throughout.
- `normalize.test.ts`: 40+ phone inputs; email edge cases; URL forms.

## 4. Integration tests — harness
- `supabase start` in CI (Docker); migrations applied; each test runs in a transaction rolled back at the end (via `postgres.js` `begin`), or with a truncate between files for storage-involving tests.
- Server actions invoked directly with a fake cookie context; route handlers invoked via `fetch` against `next dev` in test mode.

## 5. E2E — Playwright conventions
- Locale `he-IL`, timezone `Asia/Jerusalem`, viewport 1366×768 default; a 390×844 project verifies the "use a computer" gate and admin phone layout.
- Fixtures: `applyAsCandidate()`, `startAssessment()`, `answerCurrent(strategy)`, `loginAsAdmin()`.
- Timer tests use the test clock; real-time tests exist for one full 27-item run with `time_limit_s` overridden to 3 s via a test blueprint.
- Integrity: `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` is **not** used; real tab switching via a second page in the same context and `page.bringToFront()`.

## 6. Bank audit (CI gate)
`pnpm bank:audit` — fails the build if any invariant in `ASSESSMENT_DESIGN.md` §4.4 is violated; prints per-family variant estimates and collision probability for 500 sessions.

## 7. Security tests
- pgTAP, **RLS at the layer that matters** (role `app_user`, the credential in daily use):
  - with `app.context = 'candidate'` and `app.application_id = A`, `SELECT * FROM applications` returns only A; `SELECT * FROM assessment_items` returns only A's items; `UPDATE assessment_responses` on B's row affects 0 rows; `INSERT` into B's session is rejected by `WITH CHECK`; `SELECT FROM admin_users`/`admin_notes` → 0 rows.
  - with `app.context = 'admin'` and a disabled or unknown `app.admin_id`, every table returns 0 rows and every write fails.
  - with no context set, every table returns 0 rows (policies default to deny).
  - `app_user` cannot `DELETE` from `candidates`/`applications`/`assessment_sessions` directly (permission denied) and cannot `INSERT`/`UPDATE` `cv_files`; the `SECURITY DEFINER` functions succeed.
  - `app_user` cannot `SELECT` from `auth.*` or `storage.*`; cannot create tables; `rolbypassrls = false`.
  - `anon` and `authenticated`: permission denied on every table; storage bucket `cv` `public = false`; no storage policies.
- Route tests: candidate cookie for application A cannot read/answer B (404 from the app **and**, with the app-layer check deliberately disabled in a test build, 0 rows from the DB — proving the second boundary); tampered HMAC → 401; expired cookie → redirect; admin routes without session → login; admin API with candidate cookie → 401.
- Scripted-endpoint test: a Node script drives `GET /current` + `POST /answer` with a valid cookie and correct tokens for a full session with human-like delays and no events; the session completes (we do not block it) and its integrity level is `high` with the telemetry-gap reason.
- Answer endpoint: unknown option id → 400; oversized payload (> 32 KB) → 413; non-JSON content type → 415; wrong `Origin` → 403.
- Rate limits: 6th signup from the same prefix within an hour → 429 with Hebrew message.
- Headers: CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'` asserted on candidate and admin pages.
- Upload: polyglot file (PDF header + script) accepted as PDF but served with `Content-Disposition: attachment` and correct MIME; SVG/HTML rejected.
- Signed URL expires (fetch after 61 s → 4xx).
- Dependency audit: `pnpm audit --prod` in CI (warn, not block — avoids "maintenance by CI").
- Pre-launch manual checklist: secrets not in repo (git history grep), Supabase dashboard sign-ups disabled, MFA enforced, service key not in any `NEXT_PUBLIC_*` var (a unit test asserts no `NEXT_PUBLIC_` var contains "SERVICE"), `MIGRATION_DATABASE_URL` absent from Render, health response contains no version/SHA.

## 8. Load tests (k6, before launch)
- Scenario A "exam day": 200 virtual candidates, each: start session, answer 27 items with think time drawn from the block's limit (uniform 30–90 % of limit), flush events. Pass: p95 answer→next-item server time < 150 ms; 0 errors; pool never saturates.
- Scenario B "admin under load": while A runs, 3 admins paginate/filter the list every 5 s. Pass: p95 < 300 ms.
- Scenario C "list at scale": 5,000 applications seeded; default list, each quick filter, and search: p95 < 150 ms server time.
- **Scenario D "synchronized start"** (the realistic risk case): 150 virtual candidates all execute `submitPersonalDetails` → `confirm` → `startAssessment` → first `GET /current` within a 10 s window, then continue as in A. Pass: p95 **time-to-first-item** (from `startAssessment` request to first item rendered payload) < 500 ms; p99 < 1,500 ms; 0 pool-wait timeouts; process RSS < 300 MB throughout and no GC pause > 200 ms (measured via `--trace-gc` in the test run); no item's `served_at` is set more than 200 ms before its payload leaves the server (asserted from logs, to prove pool wait does not land inside a candidate's clock).
- Scenario E "sweep under load": during D, force the hourly sweep; health p95 stays < 300 ms and the sweep's 2 s budget is respected.

## 9. Pilot (human calibration, before public launch)
- 10–20 known-strong students, 3–5 non-CS controls, and **at least 3 pilots for whom Hebrew is a second language**; the group is drawn from at least two institutions.
- Pass criteria: ≥ 70 % of strong pilots finish each item type with ≥ 15 % time left, **including the second-language subgroup on the investigation block**; block medians between 35 and 90; no item family with accuracy < 20 % or > 95 % across the pilot; difficulty-3 instances score lower than difficulty-1/2 within each family (spot-check; families that invert are flagged); integrity risk "low" for all honest pilots (false positive check, including at least two pilots who use a second monitor with chat open); one deliberately "cheating" pilot (ChatGPT in another tab) lands at medium/high; one pilot who scripts the endpoints lands at high.
- **Reliability**: compute split-half reliability (odd/even items, Spearman–Brown) per pillar. If the investigation block's reliability is more than 0.15 below the reasoning block's, apply the pre-committed weight fallback (`SCORING.md` §3.3) before launch.
- Bidi cost: compare median time-used on speed items with LTR snippets vs. those without; if the gap exceeds 25 % of the limit, raise the speed-block limit to 25 s in the blueprint.
- Fixes go into the blueprint (limits, mix, weights) or template tweaks, then re-run `bank:audit`.
- **Backup restore drill** is part of the pre-launch checklist (`DEPLOYMENT.md` §8 step 12).

## 10. Accessibility
axe-core on every page in the e2e suite (no `critical`/`serious` violations); keyboard-only run of the full assessment; `prefers-reduced-motion` respected on the timer bar.

## 11. Regression protection for "historical results never change"
Fixture: a completed session from `scoring_version = 1` stored as JSON. Test asserts that recomputation with the current code reproduces the same `assessment_results` unless `scoring_version` was bumped, in which case the test requires an explicit changelog entry in `SCORING.md`.
