# ARCHITECTURE

Status: **Decided.** This document is the system-level spec. Every other doc in `docs/` assumes the decisions here.

## 1. Decisions at a glance

| Concern | Decision |
|---|---|
| Application framework | **Next.js 15 (App Router) + TypeScript**, one codebase serving candidate UI, admin UI, and all server logic |
| Runtime host | **One Render Web Service** (Node 22 LTS, Starter plan, single instance, autoscale off) |
| Database | **Supabase Postgres** (Supabase project in `eu-central-1` Frankfurt, closest region to Israel) |
| DB access model | **Server-only, least-privilege role, real RLS.** The Next.js server is the sole DB client and connects as a dedicated Postgres role `app_user` (not `postgres`, not `service_role`; `NOBYPASSRLS`). Every transaction sets a request context (`app.context`, `app.application_id`, `app.admin_id`) and RLS policies scope candidate transactions to their own application rows. The service-role key is used **only** for Storage signed URLs and Auth admin API, never for data. No browser ever talks to Supabase directly; `anon`/`authenticated` have all privileges revoked |
| Admin auth | **Supabase Auth** (email + password, magic link as fallback) via `@supabase/ssr`, gated by an `admin_users` allowlist table |
| Candidate auth | **No accounts.** A signed, httpOnly, SameSite=Lax cookie carries an opaque `application_id` token; the server resolves everything from it |
| File storage | **Supabase Storage**, one private bucket `cv`, server-generated signed URLs (60 s) for admin downloads only |
| Question content | **Parameterized templates in code** (`/src/assessment/bank/*.ts`), seeded deterministic generation per session. **No runtime LLM calls** |
| Timing authority | **Server.** Every item has `served_at`/`deadline_at` written once by the server; client timers are display-only |
| Realtime / polling | **None.** No websockets, no polling loops. Candidate flow is request/response; admin pages are server-rendered on navigation |
| Camera / proctoring | **Omitted** (see `ANTI_CHEATING.md` §1) |
| Email | **Resend** (transactional). **Required at launch** (`EMAIL_ENABLED=true` is a boot-time check in production): application received + resume link, re-entry OTP, "not moving forward" closure notice. No admin digest (replaced by counters on the admin list) |
| Alerting | **Sentry on by default** (required `SENTRY_DSN`, free tier) with email alerts to the hiring manager; **UptimeRobot** (free) pinging `/api/health` every 5 min with email on downtime; Render deploy/health-failure emails; in-app admin banners for invariant checks (see §10) |
| Maintenance sweeps | **No cron, no extension dependency.** A throttled hourly sweep runs inside `/api/health` (which Render calls every 30 s forever): IP nulling, rate-limit cleanup, CV purge-queue drain, abandoned-session finalization, retention pruning, invariant checks. See §8 |
| i18n | `next-intl`, `he` default locale, all strings in `messages/he.json`; `en.json` can be added later without code change |
| Background jobs / cron | **None.** Everything that looks like a job is done lazily at request time or inside the same DB transaction |

## 2. Why this stack

**Next.js on Render.** A single Node process serves both UIs and the API. Render's Web Service gives us TLS, health checks, zero-downtime deploys, and automatic restarts with no server management. Next.js App Router gives server components (admin tables render on the server with one SQL query, no client waterfall), Server Actions (form submissions with CSRF built in), and route handlers (the few JSON endpoints the assessment runner needs). Any implementation team in Israel knows it; that matters for a "build once" project because the *next* person who touches it must not need onboarding.

Rejected alternatives: SvelteKit/Remix (equivalent technically, smaller hiring pool); separate SPA + API (two deployables, double the surface, CORS, no benefit at this scale); Supabase Edge Functions as backend (Deno runtime, harder local testing, splits logic across two hosts).

**Supabase Postgres, server-only access with defense in depth.** We use Supabase for what it is unbeatable at with zero maintenance: managed Postgres with backups, Auth, and Storage. We deliberately do **not** use its client-side data access (PostgREST from the browser) because:

1. The candidate flow requires server-authoritative timing and scoring; letting a browser write responses directly is incompatible with that.
2. Admin data is sensitive (PII, CVs). One application trust boundary is easier to audit than browser-facing policies.

But one trust boundary is not enough on its own: a single missed `WHERE application_id = …` in a route handler must not expose the whole dataset. So the DB enforces a second boundary that applies to the credential actually in use 24/7:

3. The app connects as `app_user`, a role created by migration with **explicit grants only** on `public` tables (no `auth`/`storage` schema access, no DDL, `NOBYPASSRLS`). Migrations run as the project owner through a separate credential that never lives on Render.
4. **RLS policies are real and apply to `app_user`.** Every transaction starts with `SET LOCAL app.context = 'candidate'|'admin'|'system'`, plus `app.application_id` (candidate) or `app.admin_id` (admin). Policies on every candidate-touchable table allow candidate transactions to see and write only rows of their own application; admin transactions require `app.admin_id` to match an enabled `admin_users` row; `system` context is used only by boot-time and health-sweep code paths. A route that forgets its `WHERE` still gets only its own application's rows. Details and the policy set: `DATA_MODEL.md` §6.
5. `anon`/`authenticated` (the PostgREST roles) have all privileges revoked and no policies; the anon key is used only by Supabase Auth for admin login.

The service-role key is confined to two server-side calls (signed URL creation, Auth admin invite) and is never used with PostgREST for data.

**One Render service.** Hundreds-to-low-thousands of candidates per hiring round is a tiny load. A single Starter instance (512 MB) handles it with large margin (see §7). A second instance is a one-line change in `render.yaml` if ever needed; nothing in the design assumes a single process (no in-memory session state, no local file writes).

## 3. Hosting topology

```
                 ┌─────────────────────────────────────────────┐
  Candidate ───▶ │  Render Web Service  "screening-web"        │
  (browser)      │  Next.js 15, Node 22, port 10000            │
                 │  /            candidate flow (he, RTL)      │
  Admin ───────▶ │  /admin/*     admin UI (Supabase Auth)      │
  (browser)      │  /api/*       route handlers (JSON)         │
                 │  /api/health  health check                  │
                 └───────┬────────────────────┬────────────────┘
                         │ service-role key   │ signed URLs
                         ▼                    ▼
                 ┌──────────────────┐  ┌──────────────────┐
                 │ Supabase Postgres│  │ Supabase Storage │
                 │ (RLS on, 0 pol.) │  │ bucket: cv (priv)│
                 └──────────────────┘  └──────────────────┘
                         ▲
                 ┌──────────────────┐
                 │ Supabase Auth    │  admins only (MFA required)
                 └──────────────────┘
                              ┌──────────┐  ┌──────────┐  ┌─────────────┐
                              │  Resend  │  │  Sentry  │  │ UptimeRobot │
                              │  email   │  │  errors  │  │ pings health│
                              └──────────┘  └──────────┘  └─────────────┘
```

No worker, no cron service, no Redis, no CDN beyond what Render provides, no third-party analytics. Sentry and UptimeRobot are alert channels only (free tiers, configured once); the product functions without them but production boot refuses to start without `SENTRY_DSN` so that "alerting quietly off" cannot happen.

## 4. Code layout

```
/src
  /app
    /(candidate)/[locale]/...        candidate pages: apply, job, briefing, assessment, done
    /admin/...                       admin pages (server components + server actions)
    /api/assessment/...              route handlers used by the assessment runner
    /api/health/route.ts
  /assessment
    /bank/                           question templates (reasoning/, tech/, investigate/, speed/)
    generator.ts                     seed → concrete session items
    scoring.ts                       pure functions: responses → pillar scores
    integrity.ts                     pure functions: events → risk level + reasons
    timing.ts                        deadline math, grace, clock-skew handling
  /db
    client.ts                        single server-side Supabase client (service role)
    queries/                         typed SQL via postgres.js (direct Postgres, not PostgREST)
  /i18n
    messages/he.json, en.json
  /lib                               validation (zod), phone/email normalization, cookies, crypto
/supabase
  /migrations/0001_init.sql ...      schema, indexes, RLS, seed job
  config.toml
render.yaml
```

Rule: **all assessment logic is pure TypeScript with no I/O** (`generator.ts`, `scoring.ts`, `integrity.ts`, `timing.ts`). This makes it unit-testable to exhaustion and lets the same code run in tests, in the server, and in an offline "bank audit" script.

## 5. Request flow

### 5.1 Candidate — apply
1. `GET /jobs/{slug}` renders the job landing (server component).
2. `POST` server action `submitPersonalDetails` validates with zod, normalizes phone to E.164 (`+972…`) and email to lowercase, upserts `candidates` on `email_normalized`, creates `applications` (status `applied`), records consent, sets the candidate cookie. Duplicate phone → flagged on the application, not blocked.
3. Job description step → `confirmJobUnderstanding` action writes `job_confirmed_at`.
4. Briefing step → `startAssessment` action:
   - Creates `assessment_sessions` row with `seed = random 64-bit`, materializes all item instances into `assessment_items` (one insert of 27 rows) using `generator.ts`, sets `expires_at = now() + 75 min` (hard wall-clock cap).
   - Status → `assessment_started`.

### 5.2 Candidate — assessment runner (the hot path)
The runner is a small client component. It talks to exactly two JSON endpoints:

- `GET /api/assessment/current` → returns the current item (rendered content, options, `deadline_at`, `server_now`, and a per-serve `item_token`) and session progress. On **first** serve of an item the server sets `served_at = now()`, `deadline_at = served_at + time_limit`, and a random `serve_nonce`. Later calls return the same item with the same `deadline_at` (and the same token). This is what makes refresh safe and non-exploitable.
- `POST /api/assessment/answer` `{item_id, item_token, answer, client_meta, events[]}` → server verifies `item_token` (HMAC over `item_id ‖ serve_nonce`), checks `now() <= deadline_at + 2 s grace`; if late, the item is recorded as `expired` with no answer. Either way the item is finalized, integrity events are inserted, and the response body **includes the next item** (so a transition costs one round-trip; realistic end-to-end from Israel is 80–150 ms on a good connection, more on weak mobile links — the per-item margins in `ASSESSMENT_DESIGN.md` §2.2 are sized for that, not for the 40 ms network RTT). Server never accepts an answer for a non-current item.

Client timer = `deadline_at − (Date.now() + skew)` where `skew = server_now − Date.now()` measured on each response. The client auto-submits when it hits zero; the server's check is what counts.

Integrity events are buffered client-side and flushed with each answer, plus a `navigator.sendBeacon` to `/api/assessment/events` on `visibilitychange` and `pagehide` so nothing is lost on tab close. No separate heartbeat. An answer that arrives with **no** client events and no `first_interaction_ms` is legal (the server never rejects it) but is recorded as a telemetry-empty item; a session with many such items is a strong integrity signal in its own right (`ANTI_CHEATING.md` §5.3).

**Server outage credit (fairness under platform downtime).** A single-row `liveness` table is touched by any request at most once per 15 s. At boot, before the process starts listening, it compares `liveness.at` with its own start time; a gap > 20 s is an outage window `[liveness.at, boot_at]`. For every unfinalized item whose `[served_at, deadline_at]` overlaps that window, `deadline_at` is extended by the overlap (capped at one full `time_limit_s`), the session's `expires_at` is extended by the same amount, `outage_credit_ms` is recorded on the item, and a `server_outage` integrity event is written (an excusal, shown to the admin). This is done by a single `SECURITY DEFINER` function that is the only code path allowed to change `deadline_at` (the immutability trigger checks for it). The credit derives exclusively from server-side facts — no client input can trigger or size it — so it does not reopen timer manipulation. Zero-downtime Render deploys keep the old instance serving until the new one is healthy, so a normal deploy produces no gap and no credit; crashes and failed deploys do.

After the last item: scoring runs synchronously inside the finalizing transaction (`scoring.ts` + `integrity.ts`), writes `assessment_results`, sets application status `assessment_completed`. Sub-100 ms; no queue needed.

### 5.3 Admin
Server components query Postgres directly with `postgres.js` (connection pooled through Supabase's Supavisor pooler, transaction mode, app-side pool max 20 — sized for a synchronized start burst, not steady state; see §7). Lists are paginated (keyset, 50 rows) and sorted in SQL over indexed columns. Detail pages do 3–4 queries in parallel. Mutations (stage change, notes, job edits) are Server Actions that revalidate the path. No client-side data fetching library.

## 6. Security architecture

- **Secrets**: runtime secrets only in Render env vars (`DATABASE_URL` for `app_user`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CANDIDATE_COOKIE_SECRET`, `RESEND_API_KEY`, `SENTRY_DSN`). The **migration credential** (`MIGRATION_DATABASE_URL`, project-owner role) is held only in the developer's password manager and in a GitHub Actions secret used by the manual `migrate` workflow; it is never on Render. Never in the repo; `.env.example` documents names only.
- **Candidate cookie**: `app_session` = base64url(`application_id` ‖ HMAC-SHA256(`application_id`, secret)), httpOnly, Secure, SameSite=Lax, path `/`, max-age 14 days. It grants access only to that application's own flow. **Re-entry** (cleared cookies, new device): `/resume` accepts email + the 8-character **resume code** shown on the step-1 success screen and included in the confirmation email; alternatively an email OTP. Both paths are rate-limited (`CANDIDATE_FLOW.md` §2.4). Admins can also copy a signed resume link from the candidate page.
- **Admin**: Supabase Auth session cookie (`@supabase/ssr`) with **MFA (TOTP) mandatory**: middleware on `/admin/*` verifies the JWT locally (`SUPABASE_JWT_SECRET`), requires `aal2`, and checks the email exists in `admin_users` with `disabled_at IS NULL`. An invited admin cannot reach any data page until TOTP enrollment is complete. Bootstrap: `pnpm admin:add email`; later admins from the settings screen.
- **Rate limits**: Postgres-backed token bucket per IP + route for `submitPersonalDetails`, resume/OTP, and admin login (`rate_limits` table, cleaned by the hourly sweep). No Redis.
- **Input**: zod schemas for every action/route; file uploads validated by magic bytes (**PDF and DOCX only** — legacy `.doc` is dropped because it is a macro-capable binary container; DOCX cannot carry macros) and size ≤ 5 MB; filenames replaced with UUIDs; downloads served with `Content-Disposition: attachment` and the validated MIME type.
- **Answer replay**: `POST /answer` requires the per-serve `item_token`; a captured request cannot be replayed for another item, and the token is only obtainable through `GET /current` for the current item. (This raises the cost of scripting; it does not prevent the cookie owner from scripting both endpoints — that case is handled by the telemetry-gap floor in `ANTI_CHEATING.md` §5.3.)
- **Headers**: strict CSP (self + Google Fonts + Supabase storage host), `frame-ancestors 'none'`, HSTS, Referrer-Policy `strict-origin-when-cross-origin`.
- **CSRF**: Server Actions carry Next.js origin checks; JSON route handlers require `Content-Type: application/json` and validate `Origin` against `APP_BASE_URL`.
- **PII minimisation**: IP is stored truncated (/24 for v4, /48 for v6) except on integrity events during the assessment, where full IP is kept 90 days then nulled lazily (see §8).
- **Deletion**: every candidate/application deletion — admin "מחק מועמד", bulk archive-and-delete, retention pruning — calls one SQL function `delete_candidate(candidate_id)` (cascades DB rows). Storage cleanup is **structural, not code-discipline**: a trigger on `cv_files` (`AFTER DELETE OR UPDATE OF object_path`) enqueues the old object path into `cv_purge_queue`; the queue is drained by the health sweep and by every CV upload/download request; the health check reports the backlog and Sentry alerts if any entry is older than 24 h. A CV can therefore never be orphaned by a cascade, a manual SQL fix, or a re-upload. See `DATA_MODEL.md` §3.9.

## 7. Performance strategy

- Assessment transitions: one round-trip; item content is pre-materialized in the DB at session start, so serving an item is a single indexed `SELECT`. Answer + next item is one transaction (~3 statements).
- Candidate bundle: the runner page ships ≈ 90 KB gzipped JS (React + runner + one SVG renderer). No chart library, no UI kit on the candidate side. Fonts: `Heebo` (Hebrew + Latin) via `next/font` with `display: swap`, self-hosted at build time (no runtime Google Fonts dependency).
- Admin lists: keyset pagination, all sort keys are indexed or come from `assessment_results` denormalized columns. 5,000 candidates sort/filter in < 20 ms.
- Rendering: candidate pages are dynamic (they depend on the cookie) but tiny; admin pages are dynamic. Static assets are immutable and cached by Render's edge.
- DB: pooled connections (Supabase Supavisor, transaction mode). App-side pool **max 20** (Supavisor's default client limit on Pro is far higher). Steady state needs ~2; the pool is sized for the realistic risk case — a **synchronized start burst** (a reminder email goes out, 100+ candidates click "מתחילים" within 10 s), where `startAssessment` (27-row insert) and the first `GET /current` (sets `served_at`) must not queue behind a 5-connection pool. Pool wait during a burst is server-side delay that eats a candidate's timer; the target is p95 time-to-first-item < 500 ms at 150 simultaneous starts (`TEST_STRATEGY.md` §8, Scenario D).
- Capacity: a single Starter instance handles ~200 concurrent candidates in an assessment (each does one request per ~60 s) with < 5 % CPU, and a 150-start burst within memory headroom (`--max-old-space-size=384`, measured in Scenario D).
- Top-of-funnel pages (landing, step 1–3) have their own bundle budget: ≤ 60 KB gzipped JS per route — no markdown library at runtime (job description is rendered to HTML on save and stored), no UI kit; these are the pages that see phone traffic on average Israeli mobile networks.

## 8. Zero-maintenance design

**The hourly sweep.** Render calls `/api/health` every 30 s for the life of the service; UptimeRobot every 5 min. The health handler, after its checks, runs `UPDATE maintenance SET last_sweep = now() WHERE last_sweep < now() - interval '1 hour' RETURNING 1` — exactly one caller per hour wins and runs the sweep in `system` context, bounded to ≤ 2 s of work (batches of 1,000 rows, remainder next hour). This is the platform's scheduler: it needs no extension, no worker, no cron, and it cannot silently stop because the health check itself is monitored. Sweep steps, in order: (1) `liveness` touch; (2) IP nulling; (3) rate-limit cleanup; (4) CV purge-queue drain; (5) abandoned-session finalization; (6) retention pruning (`DATA_MODEL.md` §8); (7) invariant checks → Sentry warning + admin banner rows (`§10`).

| Would normally need a job | How we avoid it |
|---|---|
| Expiring abandoned sessions | Session has `expires_at`; any read of a session past it treats it as `abandoned` and lazily updates the row; the sweep finalizes the rest so results exist for every started session |
| Rate-limit bucket cleanup | Sweep deletes rows older than 1 h |
| IP anonymization after 90 days | Sweep: `UPDATE integrity_events SET ip = NULL WHERE ip IS NOT NULL AND created_at < now() - interval '90 days'` (batched). Guarantee: within 90 days + 1 hour, unconditionally. No `pg_cron` |
| Retention (PII, telemetry) | Sweep prunes per the bounded policy in `DATA_MODEL.md` §8 |
| Orphaned CV objects | Trigger-fed `cv_purge_queue` drained by the sweep; backlog visible in health + Sentry |
| Question bank refresh | Bank is code; variability comes from parameters and seeds, not from new content. Adding templates is a code deploy, never a runtime task |
| Log rotation | Render handles it |
| DB backups | Supabase daily backups (Pro) — enabled at setup, no ongoing action |
| Cert renewal | Render |
| Dependency / runtime updates | **One bounded exception to zero maintenance, stated plainly:** once a year (calendar reminder to the hiring manager), a developer spends about half a day to bump Node to the current LTS, update dependencies to latest patch/minor versions, run CI, and deploy. GitHub **Dependabot security alerts** are enabled (alerts only, no auto-PRs) so a critical CVE is visible in between. Renovate/auto-PRs are not configured. Launch runtime is Node 22 LTS (maintained until April 2027) |
| Email deliverability | Resend with verified domain at setup; email failures never block a candidate flow (queued in `email_outbox`, retried by the sweep, surfaced in health) |

**What still needs a developer (so "zero maintenance" is not misread):** a differently-shaped assessment (new `assessment_configs` blueprint or new templates), any schema change, the annual runtime bump, and disaster recovery. Adding jobs, admins, reviewing candidates, stage changes, bulk archive/delete, and deletion requests never do.

## 9. Localization architecture

- `next-intl` with locale segment `/[locale]/` for candidate pages; `he` is default and the only locale enabled at launch. `<html lang dir>` are set from locale (`dir="rtl"` for `he`).
- All UI text lives in `messages/he.json`. Question templates carry `{ he: …, en?: … }` text blocks; rendering falls back to `he` when `en` is missing, so English can be added template-by-template.
- CSS uses **logical properties only** (`margin-inline-start`, `padding-inline`, `text-align: start`). Tailwind configured with the RTL plugin removed — logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) are used exclusively; a lint rule (`eslint-plugin-tailwindcss` custom rule) forbids `ml-/mr-/pl-/pr-/left-/right-` in the codebase.
- Mixed-direction text: technical tokens (code, URLs, numbers, emails, phone numbers) are always wrapped in `<bdi>` or `<span dir="ltr">` by a shared `<Term>` component; code blocks are `dir="ltr"` with `text-align: left` explicitly. Numbers use `Intl.NumberFormat('he-IL')`; dates use `Intl.DateTimeFormat('he-IL')`.
- Admin UI is Hebrew-only at launch but is built through the same `messages` files, so it flips to English with the same mechanism.

## 10. Observability and alerting (minimal, but loud when it matters)

Silence is not "nothing to do". The design has three alert channels, all free-tier and configured once, and none of them requires anyone to look at a dashboard:

1. **Sentry (required in production).** Every unhandled error, every 5xx, every boot-time check failure (migration mismatch, env), and every **invariant warning** from the hourly sweep is captured. Sentry's "new issue" email alert is pointed at the hiring manager plus an optional developer address. Sentry is a config value, not a workload.
2. **UptimeRobot (free)** pings `/api/health` every 5 min and emails on downtime or on a 503 (which the health endpoint returns for migration mismatch, DB failure, or a CV purge backlog > 24 h).
3. **Render** emails on failed deploys and repeated health-check failures.

**Invariant checks (run by the hourly sweep, each produces an `admin_alerts` row shown as a banner on the admin list, and a Sentry warning the first time it fires):**
- A template family whose accuracy over its last 50 served instances is outside [10 %, 95 %] (broken answer key, mis-rendered item, or leaked content).
- A template family whose expiry rate among candidates scoring ≥ 65 overall exceeds 35 % (the timer, not ability, is binding for strong candidates).
- A scenario whose accuracy rose by > 25 points between its first 50 and its most recent 50 servings within a job (word-of-mouth leakage signal).
- `cv_purge_queue` entries older than 24 h; `email_outbox` entries failed > 3 times.
- DB size > 70 % of the plan's included storage (`pg_database_size`), shown permanently in Settings and as a banner past the threshold.
- Sessions with `outage_credit_ms > 0` in the last 24 h (so the admin knows an outage happened and who was credited).

Also: structured JSON logs to stdout (route, status, duration, `application_id`/`admin_id`); `/api/health` returns component status without the git SHA (the SHA is in the admin Settings page, behind auth). The hiring manager's runbook (`DEPLOYMENT.md` §14) says what each email looks like and whom to forward it to.
