# Implementation notes

Decisions made while scaffolding this repo where the spec in `docs/` was
silent on a concrete detail, or where two documents disagreed. Each is the
smallest reasonable choice consistent with the rest of the spec. Referenced
from `IMPLEMENTATION_STATE.md`.

## Local database testing (no Docker/Supabase CLI in this environment)

This dev machine has neither Docker nor the Supabase CLI, so `supabase
start`/`supabase db push` against a real Supabase stack isn't possible here.
Instead, `scripts/local-pg-setup.sh` installs Postgres 16 via Homebrew and
applies `supabase/migrations/*.sql` against it directly with `psql`, after
stubbing the handful of objects Supabase's platform normally pre-creates
that our migrations assume exist (`anon`/`authenticated`/`service_role`
roles, `auth`/`storage` schemas, a minimal `storage.buckets` table). Run it
with `./scripts/local-pg-setup.sh [dbname]`, then `psql -d <dbname>` or point
`DATABASE_URL` at it.

Running this caught and fixed one real bug in `0001_init.sql`: an
expression (`meta->>'key'`) inside a table-level `unique (...)` constraint,
which Postgres rejects — fixed by using `create unique index ... on
admin_alerts (code, (meta->>'key'))` instead. Both migrations, all 21
tables, 24 RLS policies, and all 7 `SECURITY DEFINER` functions now apply
cleanly end-to-end; the seeded job and assessment blueprint were spot-checked
and match `DECISIONS_LOG.md` (27 items, investigate block 4×180s, weights
0.30/0.30/0.25/0.15).

This local stub setup is good enough for smoke-testing migration SQL and for
running the pgTAP suite (`TEST_STRATEGY.md` §7) against real Postgres
semantics (RLS, triggers, constraints). It is **not** a substitute for
testing against a real Supabase project before launch — it has no PostgREST,
no real Auth/Storage service, and no `supabase_migrations` schema, so the
boot-time schema-version check and any Storage-API-level behavior still need
verification against a real (even free-tier) Supabase project first.

## Tooling

- **Package manager: pnpm, not npm.** `docs/DEPLOYMENT.md` (`render.yaml`
  buildCommand, `package.json` scripts list, CI in §13) consistently
  specifies pnpm. The task brief said "run `npm install`/`npm run build`
  (or equivalent)" — pnpm is that equivalent, and using it keeps the repo
  consistent with the deployment doc instead of having two competing
  lockfile conventions. `corepack enable` picks up the pinned version from
  `packageManager` in `package.json`.
- **Node and pnpm were not preinstalled** in the environment this was built
  in; Node 22 was installed via Homebrew (`brew install node@22`) and pnpm
  via `corepack prepare pnpm@9 --activate`. Nothing about this affects the
  repo itself — `.node-version`, `package.json` engines/packageManager, and
  `render.yaml`/CI already pin the expected versions for anyone else's
  machine or CI runner.
- **Next.js patched to 15.5.25** (the design spec says "Next.js 15" without
  a patch version). 15.1.6 — a natural first guess — carries a known CVE
  (see `pnpm install` warning); 15.5.25 is the latest 15.x patch and stays
  on the same major the spec calls for. `eslint-config-next` and
  `@playwright/test` were bumped alongside it to satisfy peer-dependency
  ranges.
- **next-intl pinned at 3.26.3, not the current 4.x line.** next-intl
  shipped a major version bump (with API changes, e.g. a new `hasLocale`
  export) after this design was written. 3.26.3 is the last stable
  pre-v4 release and matches the `getRequestConfig`/`createNavigation` API
  shape the codebase uses. `src/i18n/routing.ts` exports a small
  `isSupportedLocale()` helper in place of v4's `hasLocale` so upgrading is
  a contained, deliberate choice for a future engineer rather than
  something forced on them by a stub.

## RTL lint rule (ARCHITECTURE.md §9)

The spec calls for "a lint rule (`eslint-plugin-tailwindcss` custom rule)"
forbidding `ml-/mr-/pl-/pr-/left-/right-` utilities. `eslint-plugin-
tailwindcss` doesn't expose an extension point for a project-specific
custom rule without forking the plugin, so instead there's a small
hand-written flat-config ESLint rule at
`eslint-rules/no-physical-direction.mjs`, wired into `eslint.config.mjs` as
`local/no-physical-direction`. It does the same job (flags those class
prefixes wherever they appear in a string or template literal) without a
build step or a plugin fork. If a real need for
`eslint-plugin-tailwindcss`'s other rules (class ordering, etc.) shows up
later, this local rule can run alongside it.

## Two Next.js root layouts

`src/app/(candidate)/[locale]/layout.tsx` and `src/app/admin/layout.tsx`
each render their own `<html>/<body>` — Next's App Router supports this
("multiple root layouts") when there's no single top-level
`src/app/layout.tsx`. This was necessary because the candidate side needs
`lang`/`dir` driven by the locale (`he` now, `en` later) while the admin
side is permanently Hebrew-only (`ADMIN_UX.md` §9) and isn't under
`/[locale]` at all (`ARCHITECTURE.md` §4 code layout). `globals.css` is
imported from both.

## Bare "/" route

`CANDIDATE_FLOW.md` §1's route table starts at `/jobs/{slug}`; nothing is
specified for the site root. `src/app/(candidate)/[locale]/page.tsx` is a
placeholder that links to the one seeded job, purely so the route resolves
during development. Replace or remove it once there's a real reason to
have content at `/` (a jobs index, for instance — there's only one job at
launch so there currently isn't one).

## Seed job copy source

`DATA_MODEL.md` §7 says the seed's candidate-facing text should come from
"`ASSESSMENT_DESIGN.md` Appendix A" — no such appendix exists in the
delivered docs (`ASSESSMENT_DESIGN.md` has no §5/Appendix section at all).
`CANDIDATE_FLOW.md` §3.1 is explicitly labeled "verbatim for the seed" and
contains the actual job title/description/terms-card text, so
`supabase/migrations/0002_seed.sql` uses that instead. Same content either
way was clearly intended; this is a stale cross-reference in `DATA_MODEL.md`.

## CV mime types: `.doc` excluded from the storage bucket, not just the app check

`DATA_MODEL.md` §3.9's `cv_files.mime_type` check constraint only allows
PDF and DOCX, matching `ARCHITECTURE.md` §6 ("legacy `.doc` is dropped").
`DEPLOYMENT.md` §6's literal SQL snippet for the storage bucket's
`allowed_mime_types`, though, still lists `application/msword` — a leftover
from before `DECISIONS_LOG.md` #12 "Also" tightened this. Migration `0001`
follows the authoritative, later decision (DECISIONS_LOG over the original
doc, per the task's own precedence rule) and excludes `application/msword`
from the bucket's allowed types too, so the two layers agree.

## Migration-version boot check

`DEPLOYMENT.md` §5 says boot "checks that the DB's `schema_migrations` head
matches the version compiled into the build" but doesn't specify the
mechanism. Implemented as:
- `scripts/generate-schema-version.ts` scans `supabase/migrations/*.sql`,
  takes the lexicographically-highest filename prefix before the first
  `_` (e.g. `0002_seed.sql` → `"0002"`), and writes it to the committed,
  regenerated-on-every-build file `src/generated/schema-version.ts`. Wired
  into `predev`/`prebuild` in `package.json`.
- `/api/health` reads `supabase_migrations.schema_migrations` (the table
  the Supabase CLI itself maintains — migration `0001` grants `app_user`
  read access to it if the schema exists) and compares its latest
  `version` to `EXPECTED_SCHEMA_VERSION`. Migration `0001` also grants that
  access defensively (`do $$ ... $$` guard) since the schema won't exist
  outside a real Supabase-CLI-managed database.
- **Migration filenames** stay as `0001_init.sql` / `0002_seed.sql`
  (matching `ARCHITECTURE.md` §4's code-layout example literally) rather
  than the timestamp-prefixed names `supabase migration new` generates by
  default. `supabase db push` applies migrations in lexicographic filename
  order regardless of naming scheme, so this works, but note it for
  whoever adds migration `0003`: keep incrementing the zero-padded counter
  (`0003_...`), don't mix in timestamp-prefixed names, or the version
  comparison above breaks.

## `run_maintenance_sweep()` — implemented in full, but two invariant checks are stubs

`ARCHITECTURE.md` §10 lists six invariant checks the hourly sweep should
run (template accuracy out of range, expiry-among-strong-candidates,
scenario leakage drift, CV purge backlog, email failures, DB size, outage
credits). The SQL function `run_maintenance_sweep()` in migration `0001`
implements the lock, IP nulling, rate-limit cleanup, retention pruning
(`prune_retention()`), and two of the six invariant checks (CV purge
backlog, email failures) — the two whose source data already exists in
this schema. The other four need the assessment bank / results pipeline
(template accuracy, scenario drift) or DB size tracking wiring
(`pg_database_size` is called, but nothing reads a *threshold* into an
alert yet) that don't exist until the assessment-engine and admin-ui
engineers build them. `/api/health` still surfaces `cv_purge_backlog` and
returns 503 for a stale sweep or migration mismatch, so the endpoint has
real signal from day one; the remaining checks are `TODO`s in the SQL
comments, not silently skipped.

## `/api/health` storage check

`DEPLOYMENT.md` §9 specifies "storage check is a `HEAD` on the bucket
(cached 60s)". Left as `"unknown"` in the JSON response rather than
faked as `"ok"` — wiring it up needs a live Supabase Storage bucket to hit,
which doesn't exist in the environment this was built in. DB, migration
version, and sweep/purge-backlog checks are all real.

## Sentry: minimal wiring, not the full source-map pipeline

`src/instrumentation.ts` initializes `@sentry/nextjs` from `SENTRY_DSN` and
enforces the "production boots refuse to start without it" rule
(`ARCHITECTURE.md` §3). It does not wrap `next.config.ts` in
`withSentryConfig` for release/source-map upload, which needs a Sentry
auth token that isn't part of the documented env var list — basic error
capture works without it; add the wrapper later if source-mapped stack
traces in Sentry turn out to matter.

## Admin auth middleware: intentionally not implemented

`src/middleware.ts` only applies security headers to `/admin/*` — the real
gate (verify the Supabase session JWT locally, require `aal2`, check
`admin_users.disabled_at IS NULL`, redirect to `/admin/login` or
`/admin/mfa/enroll`) is explicitly the admin-ui engineer's work
(`ADMIN_UX.md` §8, `ARCHITECTURE.md` §6). `@supabase/ssr` is already an
installed dependency for them to use.

## `cv_upsert`/`delete_candidate`/etc. rely on the migration owner having `BYPASSRLS`

These `SECURITY DEFINER` functions are owned by whichever role runs
`supabase db push` (the Supabase project owner), which has `BYPASSRLS` by
default. That's what lets them write `cv_files` (which `app_user` has no
INSERT/UPDATE grant on at all) and delete cascade through tables `app_user`
can't directly `DELETE` from, while still being *called* by `app_user`
(`grant execute` in §9 of the migration). This is exactly the mechanism
`DATA_MODEL.md` §6.1 describes ("Deletion ... is only possible through the
`SECURITY DEFINER` functions") — noted here because it's easy to assume
`SECURITY DEFINER` alone bypasses RLS, when it's actually the definer's
role attributes that do.

## What was not run end-to-end

There is no live Supabase project in the environment this was built in, so
the migrations have not been executed against a real Postgres instance.
`pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `pnpm
build`, and a Playwright smoke test against `pnpm dev` all pass — see
`IMPLEMENTATION_STATE.md` for the exact commands run. Before the first real
deploy: run `supabase db push` against a real project and `supabase test
db` (the pgTAP smoke test in `supabase/tests/database/`), then work through
`README.md`'s setup steps.

## Candidate-flow engineer's decisions (steps 1-3, resume, privacy)

### RLS/FK ordering for the first candidate+application insert

`DATA_MODEL.md` §6.3's policy pattern has a real circularity for the *very
first* signup that isn't fixable from `candidate` context no matter the
statement order, verified against the local Postgres setup before writing
any workaround:

- `candidates`'s `WITH CHECK` requires an `applications` row already
  existing with `id = app_app_id()` referencing that candidate.
- `applications`'s `WITH CHECK` requires `id = app_app_id()` — fine once you
  pre-generate the id and set `app.application_id` to it before inserting —
  but the FK `applications.candidate_id -> candidates.id` requires the
  candidate row to exist *first*.
- So `candidates` needs `applications` to exist (RLS) before `applications`
  can exist (FK needs `candidates` first). No ordering of two statements in
  one `candidate`-context transaction satisfies both; I reproduced this
  directly with `psql ... set role app_user ...` and got the RLS violation
  before writing `submitPersonalDetails`.

Resolution: `submitPersonalDetails` (candidate signup, and the duplicate
lookups it needs first) runs in **`system` context**, which
`ARCHITECTURE.md` §2 describes as reserved for "boot-time and health-sweep
code paths" — this is a third, narrow use of it, justified the same way
`cv_upsert` needed a `SECURITY DEFINER` escape hatch for an analogous
bootstrapping problem (DATA_MODEL.md §3.9). Every operation on an
*existing* application (job confirmation, briefing consent, resume-code
lookup identity resolution) still uses `candidate`/appropriate context
normally; only the one-time account-creation transaction is `system`. If a
future engineer wants to close this off more tightly, the alternative is a
`create_application()` `SECURITY DEFINER` function mirroring `cv_upsert`'s
shape — not built here to avoid multiplying security-definer surface for a
single call site without a second real need.

### OTP storage — a small additive migration, not a new table

CANDIDATE_FLOW.md §2.4's OTP fallback has no backing storage in
`DATA_MODEL.md` (no dedicated table, no columns) — this looks like a gap
left over from when the resume-code mechanism was added as the *primary*
path (DECISIONS_LOG.md #2) and OTP became secondary. Rather than a new
table, `supabase/migrations/0003_resume_otp.sql` adds three nullable/
defaulted columns directly to `applications` (`otp_code_hash bytea`,
`otp_expires_at timestamptz`, `otp_attempts smallint default 0`), mirroring
how `resume_code_hash` already lives there — smallest reasonable, additive
(expand-only per `ARCHITECTURE.md` §16's migration rule), no new grants
needed (`applications` UPDATE is already granted to `app_user`).

Simplification made without a spec answer: a candidate can have several
applications (one per job), but an OTP request only takes an email, not a
job. `requestOtp`/`verifyOtp` target the candidate's **single most recent**
application. With one active job at launch this is a non-issue in practice;
whoever adds a second job should revisit this (candidate needs a way to
pick which job's flow to resume, or every application gets its own OTP
simultaneously — either is a UI question the spec doesn't answer either).

### Privacy request email verification — not built

`DATA_MODEL.md` §3.20 says candidate-submitted `privacy_requests` rows are
"email-verified with a one-click link." That needs a verification-token
table/column and a `/privacy/verify?token=...` route that doesn't exist
anywhere in the spec's schema. Built instead: the form inserts the row
directly (rate-limited, 3/email/hour), reviewed by an admin from the
inbox — which DATA_MODEL.md §3.20 already lists as the *other* legitimate
way a row gets created ("either by an admin ... or by the candidate"). A
malicious actor can file a bogus request under someone else's email, but
they can't act on it — access/deletion still requires an admin to actually
find and verify the requester out-of-band before acting, same as any
unauthenticated contact form. Flagged here rather than silently shipping
half of a described feature.

### CSP blocked Next.js's own hydration scripts in production

Found by actually clicking through the built app in a real browser (not
just `curl`, which only sees the SSR HTML and can't tell hydration never
ran). `src/middleware.ts`'s original CSP had `script-src 'self'` with no
`'unsafe-inline'` and no nonce. Next.js's App Router streams RSC payloads
via inline `<script>` tags it injects itself — that CSP directive blocks
them outright. A plain HTTP check (`curl`, `/api/health`, a naive
`fetch().then(r => r.text())`) still sees a 200 with full SSR markup, which
is presumably why this shipped unnoticed in the foundation pass — dev mode
also has enough differences in how it serves scripts that the breakage
wasn't obvious there either in quick manual testing (see the next note).
Fixed the standard, documented way (Next.js's own CSP guide): a random
per-request nonce added to `script-src` alongside `'strict-dynamic'`;
Next.js automatically applies that nonce to its own inline scripts once it
sees one in the response's `Content-Security-Policy` header, no other code
changes needed. This is shared infrastructure touched by necessity — it
broke every route, not just the candidate-flow ones — and is unrelated to
the admin-auth TODO block in the same file (left untouched).

### dev-mode Server Action slowness (why e2e ran against a production build)

While manually verifying the flow, `submitPersonalDetailsAction` under
`next dev` intermittently took 30-90+ seconds to respond (confirmed via
timing instrumentation that the actual DB work inside the action completes
in single-digit milliseconds — the delay is entirely outside application
code, between the action returning and Next finishing the HTTP response).
The delay grew on successive requests in the same dev-server process,
which stopped once I ran `pnpm build && pnpm start` instead (production:
consistently fast, no HMR). I did not fully root-cause this — plausible
candidates are Next 15.5's dev-mode on-demand compilation of the action's
full server-side module graph (which pulls in `@supabase/supabase-js` and
`resend` transitively, even on the common path that never touches either)
combined with this sandbox running other unrelated Node processes
concurrently, or Fast Refresh/HMR bookkeeping. Practical resolution: I
verified the candidate flow's e2e suite (`tests/e2e/candidate-flow.spec.ts`)
against a production build rather than `pnpm dev`. I did **not** flip
`playwright.config.ts`'s checked-in `webServer` command from `pnpm dev` to
`pnpm build && pnpm start` — that file's own comment already flags this as
the intended switch "once there's a real backend to test against," which is
now true for the candidate-flow routes but not yet for the assessment
runner, and flipping shared CI config is a bigger decision (env vars,
Postgres availability in CI) than this one engineer's pass should make
unilaterally. Whoever owns CI next should make that switch — this note is
the evidence for why.

### e2e rate-limit budget

`submitPersonalDetails`'s 5-signups/IP-prefix/hour limit (CANDIDATE_FLOW.md
§2.2) applies per literal IP prefix, and every request from a local
Playwright run shares one `signup:unknown` bucket (no `X-Forwarded-For` on
localhost) — I hit this myself mid-session (confirmed via `select * from
rate_limits` showing `tokens = 0`) after enough manual + debug-script
signups. `tests/e2e/candidate-flow.spec.ts` is deliberately structured as
one `test.step()`-annotated journey doing exactly one signup, reused for
the resume-flow and step-order-guard assertions, rather than one signup per
`test()` — this keeps a full nightly cross-browser run (4 projects × 1
signup) comfortably under the limit. The terms-first landing-page tests
(no signup) run freely across all browsers.
