# DEPLOYMENT

Status: **Decided.** Render + Supabase, one-time setup, then nothing to operate.

## 1. Components

| Component | Provider / plan | Notes |
|---|---|---|
| Web app | Render Web Service, **Starter** ($7/mo), region **Frankfurt**, **Node 22 LTS** | Single instance; health check `/api/health`; auto-deploy from `main` |
| Database + Auth + Storage | Supabase, **Pro** ($25/mo), region **eu-central-1 (Frankfurt)** | Pro gives daily backups + 7-day PITR option, no project pausing, 8 GB DB, 100 GB storage. Free tier pauses inactive projects — unacceptable for "zero maintenance" |
| Transactional email | Resend, free tier (3,000/mo) | **Required**; verified sending domain. ≈ 2–3 emails/candidate → free up to ≈ 1,000 candidates/month; the next tier is ≈ $20/mo in a heavy month |
| Error alerting | Sentry, Developer (free) tier | **Required** (`SENTRY_DSN`); email alerts to the hiring manager |
| Uptime alerting | UptimeRobot, free tier | **Required at setup**; 5-minute checks on `/api/health`; email on downtime |
| DNS | Existing registrar → CNAME to Render | Render provisions TLS |

Expected monthly cost: ≈ $32 + domain in a normal month; ≈ $52 in a month with > 1,000 applicants (email tier). Nothing else scales with candidate count at the volumes in scope; DB growth is bounded by the retention policy (`DATA_MODEL.md` §8).

## 2. Repository layout relevant to deployment
```
render.yaml                      Render blueprint (service definition, env var names, health check)
.env.example                     documented env var names, no values
package.json                     scripts: build, start, migrate, admin:add, bank:audit, test:*
supabase/config.toml
supabase/migrations/*.sql        schema (0001), seed (0002), later changes
scripts/admin-add.ts             bootstrap/add admin
scripts/check-env.ts             validates env at boot; fails fast with a clear message
```

## 3. Environment variables

| Name | Where set | Required | Purpose |
|---|---|---|---|
| `NODE_ENV` | Render (auto) | yes | `production` |
| `APP_BASE_URL` | Render | yes | `https://jobs.example.co.il` — used for links, CSRF origin check |
| `DATABASE_URL` | Render (secret) | yes | Supabase **pooler** URL, transaction mode, port 6543, `sslmode=require`, **as role `app_user`** (least privilege, `DATA_MODEL.md` §6) |
| `MIGRATION_DATABASE_URL` | developer password manager + GitHub Actions secret (manual `migrate` workflow) | migrations only | Direct (port 5432) URL as the project owner for `supabase db push` and `admin:add`. **Never on Render.** Rotate after any developer leaves |
| `SUPABASE_URL` | Render | yes | Project URL (Auth + Storage endpoints) |
| `SUPABASE_SERVICE_ROLE_KEY` | Render (secret) | yes | Server-side only. Storage signed URLs, Auth admin (invite users) |
| `SUPABASE_ANON_KEY` | Render | yes | Used only by `@supabase/ssr` for the admin login flow (Auth), never for data |
| `SUPABASE_JWT_SECRET` | Render (secret) | yes | Local verification of admin JWTs in middleware (no network call per request) |
| `CANDIDATE_COOKIE_SECRET` | Render (secret, generated) | yes | HMAC key for the candidate cookie; 32+ random bytes |
| `EMAIL_ENABLED` | Render | yes — must be `true` in production | Boot refuses `false` when `NODE_ENV=production` (candidate re-entry OTP and closure emails depend on it; the resume code works regardless) |
| `RESEND_API_KEY` | Render (secret) | yes | |
| `EMAIL_FROM` | Render | yes | `"גיוס <jobs@example.co.il>"` |
| `PRIVACY_CONTACT_EMAIL` | Render | yes | Shown to candidates |
| `SENTRY_DSN` | Render (secret) | yes in production | Boot refuses to start without it in production (alerting must not be silently off) |
| `ALERT_EMAIL` | Render | yes | Hiring manager's address; used in Sentry alert rule setup and shown in the runbook |
| `LOG_LEVEL` | Render | no | default `info` |

`scripts/check-env.ts` runs at process start (`prestart`) and refuses to boot with a readable Hebrew/English message if any required variable is missing or malformed. No secret is ever committed; `.env.example` has names only; `.gitignore` covers `.env*`.

## 4. `render.yaml`
```yaml
services:
  - type: web
    name: screening-web
    runtime: node
    region: frankfurt
    plan: starter
    branch: main
    buildCommand: pnpm install --frozen-lockfile && pnpm build
    startCommand: pnpm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_BASE_URL
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: CANDIDATE_COOKIE_SECRET
        generateValue: true
      - key: PRIVACY_CONTACT_EMAIL
        sync: false
      - key: EMAIL_ENABLED
        value: "true"
      - key: RESEND_API_KEY
        sync: false
      - key: EMAIL_FROM
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: ALERT_EMAIL
        sync: false
```
Node version is pinned in `package.json` (`"engines": {"node": "22.x"}`) and `.node-version`; Render reads it.
`sync: false` = entered once in the Render dashboard (secret). `generateValue: true` lets Render generate the cookie secret.

## 5. Migrations
- Tool: **Supabase CLI** (`supabase db push`) against `MIGRATION_DATABASE_URL`, run either from a developer machine or via the manual GitHub Actions workflow `migrate` (workflow_dispatch, uses the repository secret). Migrations are plain SQL, forward-only, numbered, idempotent where cheap (`create … if not exists` for extensions and enums via `do $$ … $$` guards).
- **When:** run once at setup and again whenever a release includes a new migration file. The app does **not** run migrations at boot (a boot-time migration on a single instance is a way to get a stuck deploy with no human watching). Instead, the app checks at boot that the DB's `schema_migrations` head matches the version compiled into the build; on mismatch it logs a loud error, reports to Sentry, and `/api/health` returns 503 with `{"reason":"migration_pending"}` so the deploy is rolled back automatically by Render's health check, keeping the previous version live.
- Order for a release with a migration: `supabase db push` → merge/push to `main` → Render deploys. This is safe **only** because migrations follow the **expand/contract rule**, which is enforced, not merely stated:
  - *Expand* (release N): add tables/columns (nullable or with defaults), add indexes `CONCURRENTLY`, add functions/policies. The old app keeps working against the new schema.
  - *Migrate code* (release N): the new app reads/writes the new shape.
  - *Contract* (release N+1 or later, only after release N is live): drop/rename/`NOT NULL`. Worked example: renaming `applications.source` → `applications.source_tag` is three steps: add `source_tag` (N), app writes both / reads new (N), drop `source` (N+1).
  - **CI check** (`scripts/check-migrations.ts`, runs on every PR): fails on `DROP COLUMN`, `DROP TABLE`, `RENAME`, `ALTER … SET NOT NULL`, `ALTER … TYPE` in any migration file newer than the last deployed one unless the statement is preceded by `-- contract: <release that stopped using it>`. This makes the destructive case a deliberate, reviewed act.
- Extensions required: `pgcrypto`, `citext`, `pg_trgm` (all available on Supabase). **No optional extensions** (`pg_cron`, `pg_net`) are used anywhere.

## 6. Storage setup (one-time, in migration `0001` via `storage` schema SQL)
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv', 'cv', false, 5242880,
        array['application/pdf','application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
```
No storage policies (server-only access via service role).

## 7. Supabase Auth setup (one-time, dashboard)
- Providers: Email enabled; "Confirm email" on; "Secure email change" on.
- Site URL = `APP_BASE_URL`; Redirect URLs = `APP_BASE_URL/admin/auth/callback`.
- Email templates: Hebrew text for invite / magic link / reset (copy in `supabase/auth-templates/*.html`, pasted once).
- Disable sign-ups (`Enable sign ups: off`) — admins are created by invite only.
- Password policy: min 12 chars.

## 8. Setup steps (from zero to production, ≈ 75 minutes)
1. Create the Supabase project (Pro, eu-central-1). Copy URL, anon key, service-role key, JWT secret, pooler URL, direct URL.
2. Locally: `cp .env.example .env`, fill values, `pnpm install`, `pnpm migrate` (wraps `supabase db push`). Migration `0001` creates the `app_user` role; set its password with `pnpm db:set-app-password` (prints the pooler `DATABASE_URL` to paste into Render).
3. `pnpm admin:add --email manager@example.co.il --name "שם"` → invite email arrives; set password; **enroll TOTP** (required before any data page opens).
4. Configure Auth as in §7 (including MFA enabled). `cv` bucket is created by migration; verify in dashboard.
5. Resend: verify the sending domain (DNS), create the API key. Required — the app will not boot in production with `EMAIL_ENABLED=false`.
6. Sentry: create a project (free tier), copy the DSN, create an alert rule "new issue → email `ALERT_EMAIL`".
7. Create the Render Blueprint from the repo (`render.yaml`), fill the `sync: false` env vars. First deploy runs; boot checks confirm env, migrations, Sentry, email.
8. Point DNS CNAME to the Render hostname; Render issues the certificate.
9. UptimeRobot: HTTP(S) monitor on `https://<domain>/api/health`, 5-minute interval, keyword `"status":"ok"`, alert contact = `ALERT_EMAIL`.
10. Subscribe `ALERT_EMAIL` to Render's and Supabase's status pages; in Render, enable "deploy failed" and "service unhealthy" notifications.
11. Smoke test: open `/jobs/student-tech-2026`, complete an application end-to-end (including resume via code from a private window), log into `/admin`, view the result, download the CV, reject the test candidate (closure email arrives), delete the test candidate (CV disappears from the bucket within the next sweep — force it with `pnpm sweep:now`).
12. Enable Supabase daily backups (on by default on Pro) and PITR (recommended, small cost). **Restore test**: restore the latest backup into a throwaway Supabase project, point a local app at it, confirm the smoke-test candidate is present and a CV downloads; delete the throwaway project. Write down how long it took.
13. Put a yearly calendar reminder on the hiring manager's calendar: "annual runtime/dependency bump — book half a day of developer time" (`ARCHITECTURE.md` §8).

## 9. Health check
`GET /api/health` → 200 `{"status":"ok","db":"ok","storage":"ok","migrations":"ok","email":"ok","sweep_age_min":37,"cv_purge_backlog":0}`; any failure → 503 with the failing component; a purge backlog older than 24 h or a sweep older than 3 h returns 503 too (so UptimeRobot emails). No git SHA in the public response (it is on the admin Settings page). DB check is `select 1` with a 500 ms timeout via the pooled connection; storage check is a `HEAD` on the bucket (cached 60 s). The handler also runs the hourly maintenance sweep when it wins the lock (`ARCHITECTURE.md` §8) — bounded to 2 s so the health response stays fast. Render restarts the instance after consecutive failures and rolls back a deploy whose first health checks fail.

## 10. Runtime hardening
- Node 22 started with `--max-old-space-size=384` (Starter has 512 MB); Scenario D in `TEST_STRATEGY.md` §8 verifies a 150-start burst stays under 300 MB RSS.
- Postgres pool: **max 20**, idle timeout 30 s, connect timeout 5 s, statement timeout 10 s (set on the pooler connection). Supavisor transaction mode; `SET LOCAL` request context per transaction.
- **Graceful shutdown**: the standalone server handles `SIGTERM` by stopping accepting connections, waiting up to 10 s for in-flight requests (Render's grace period is 30 s), then closing the pool. Answer handling is a single transaction, so a kill mid-request rolls back cleanly and the client's retry (idempotent by `item_id` + `item_token`) completes it.
- **Boot sequence**: env check → migration version check → Sentry init → outage-credit pass (`ARCHITECTURE.md` §5.2) → listen. Health returns 503 until all steps pass.
- Next.js `output: 'standalone'` for a small image and fast cold start (Render Starter does not sleep, but deploys restart the process).
- Uploads streamed to Storage, never written to the local disk.
- `Cache-Control: no-store` on all candidate/admin HTML; immutable caching on hashed static assets.

## 11. Backups and recovery
- Supabase daily backups (Pro), retention 7 days; PITR recommended (small cost).
- CV objects are in Supabase Storage (replicated by the provider); the DB row holds `sha256` for integrity. Backups cover the database; Storage objects are not part of a DB restore — the restore runbook includes "run בדיקת קבצים (reconciliation) after a restore" to detect any row/object mismatch.
- Disaster recovery = new Supabase project + restore backup + re-create `app_user` password + update Render env vars. Documented in the `README` runbook (≈ 15 lines) and **exercised once before launch** (§8 step 12).

## 12. Local development
- `pnpm dev` against either a Supabase local stack (`supabase start`, Docker) or a personal Supabase project. `.env.local` documented in `.env.example`.
- `pnpm test`, `pnpm test:e2e` (Playwright), `pnpm bank:audit`.
- Seed script creates two fake candidates with completed sessions so the admin UI has data locally (never run in production; guarded by `NODE_ENV`).

## 13. CI (GitHub Actions, free tier)
On every PR: typecheck, lint (incl. the RTL logical-properties rule), unit tests, bank audit, migration expand/contract check, Playwright smoke (Chromium). On `main`: same, then Render auto-deploys. No deploy step in CI itself (Render owns deploys), so a CI outage never blocks a rollback. GitHub **Dependabot security alerts** are enabled for the repository (alerts only, no automatic PRs) with `ALERT_EMAIL` as a watcher.

## 14. Runbook for the hiring manager (non-technical)
What you may receive, and what to do:

| Email from | Means | Do |
|---|---|---|
| UptimeRobot "DOWN" | The site is not answering or health is failing (migration mismatch, DB problem, stuck file-purge queue) | If it does not recover within 15 minutes (a second email says "UP"), forward to the developer contact |
| Sentry "New issue" | An error the code did not expect, or an invariant warning (a question family looks broken, a scenario may have leaked, the DB is filling up, an outage credited candidates) | Open the link; the title is in plain language. Forward to the developer contact if it is not self-explanatory. Invariant warnings also appear as banners in the admin |
| Render "Deploy failed" / "Service unhealthy" | A code release did not go live (the previous version keeps running) or the service restarted | Forward to the developer contact |
| Supabase / Render status page | Provider incident | Nothing to do; candidates mid-test are credited automatically for server outages |
| Dependabot security alert | A library has a known vulnerability | Forward to the developer contact; it will usually wait for the annual maintenance unless marked critical |
| Calendar: annual maintenance | Once a year | Book half a day of developer time: Node LTS bump, dependency updates, CI, deploy, restore test |

Developer contact and this table are printed in the admin Settings page.
