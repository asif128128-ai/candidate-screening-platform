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

## Admin-UI engineer pass — decisions, and two bugs found in the foundation layer

Cross-linked from `IMPLEMENTATION_STATE.md`'s matching new section, which
lists what was built. This section is decisions-and-caveats only.

### Two real bugs found in already-implemented foundation code

Both were caught while wiring the candidate list up to `admin_application_rows`
(the brief said to read that view/schema directly rather than inventing a
different shape — doing exactly that surfaced these) and are fixed in
`supabase/migrations/0001_init.sql`, not worked around in application code.

1. **Missing `GRANT SELECT` on the view itself.** `admin_application_rows`
   was created, but only the tables it joins were granted to `app_user` —
   views need their own explicit grant, separate from the underlying
   tables'. Every query against it failed with "permission denied for view"
   until `grant select on admin_application_rows to app_user;` was added
   (§9 of the migration, next to the other view/table grants).
2. **The view silently bypassed RLS entirely** (more serious). Postgres
   views execute their underlying-table access with the *view owner's*
   privileges by default, not the querying role's — and the owner here is
   the migration/project-owner role, which (per this file's own "SECURITY
   DEFINER" note below) has `BYPASSRLS`. That means every RLS policy on
   `applications`/`candidates`/`assessment_results`/etc. was being silently
   skipped for *any* query through this view, regardless of `app.context`.
   Verified empirically: before the fix, `select count(*) from
   admin_application_rows` with `app.context = 'candidate'` and a bogus
   `app.application_id` returned every row in the database instead of zero.
   Fixed with Postgres 15's `security_invoker = true` view option (`create
   ... view admin_application_rows with (security_invoker = true) as
   ...`), which makes the view evaluate RLS as the querying role (`app_user`)
   instead. Re-verified after the fix (candidate context → 0 rows; no
   context at all → 0 rows; enabled admin context → all rows) and covered
   permanently by `tests/integration/admin-rls-security.test.ts`. This is
   exactly the kind of gap `ARCHITECTURE.md` §2's "a route that forgets its
   WHERE still gets only its own application's rows" defense-in-depth
   promise is supposed to prevent — it's worth an extra look at any other
   view added later for the same `security_invoker` requirement.

### Admin auth architecture

- **Split across two runtimes, deliberately.** `ADMIN_UX.md` §8 describes
  the gate as one thing ("middleware checks admin_users allowlist... requires
  aal2"), but Edge middleware cannot open a raw Postgres connection
  (`postgres.js` needs real TCP sockets), so the DB-backed allowlist/
  `disabled_at` check cannot live there. It's split: `src/middleware.ts`
  does the JWT-signature + `aal2` check (Edge-safe, `jose`, no network round
  trip — matches the literal wording in `.env.example`'s
  `SUPABASE_JWT_SECRET` comment, which predates this pass and already said
  "used to verify admin session JWTs locally in middleware"), and
  `src/app/admin/(protected)/layout.tsx` (a Server Component, Node.js
  runtime) does the `admin_users` lookup via `src/lib/current-admin.ts`.
  Both run before any data page renders, so the net effect matches the spec;
  only the mechanism is split.
- **The `admin_users` lookup runs in `system` DB context, not `admin`.**
  The RLS policy on `admin_users` (`DATA_MODEL.md` §6.3) only allows reads
  when `app.admin_id` already names an *enabled* admin — which is exactly
  the fact a fresh login needs to establish. There is no context that can
  resolve "email → admin_id" other than `system`. This is narrow (one
  `SELECT` by an email that already passed Supabase's own signed-JWT
  verification) and is the only path that can turn a login into an
  `app.admin_id` at all; `src/lib/current-admin.ts` documents this at the
  call site. `ARCHITECTURE.md` §2's "system context is used only by
  boot-time and health-sweep code paths" should be read as "...and this one
  narrow admin-session-resolution case."
- **A CSP nonce was required for *any* admin client component to work at
  all**, and is not a candidate-flow change even though it touches
  `src/middleware.ts`'s shared `withSecurityHeaders()`. The existing
  `script-src 'self'` (no nonce, no `unsafe-inline`) blocks every inline
  `<script>` Next.js itself generates to stream RSC/hydration payloads into
  the page — discovered because every button/form/tab in the admin UI
  silently no-op'd in a real browser (visible only as CSP violations in the
  console, not as a build or type error). Fixed per Next's documented
  nonce pattern, **scoped to `/admin/*` only** (a per-request nonce
  generated in `guardAdminRoute`, threaded via an `x-nonce` request header,
  referenced in the CSP `script-src`) — the task said not to touch the
  candidate-cookie/rate-limiting parts of `src/middleware.ts`, and the
  candidate side has no interactive client component yet (the assessment
  runner is still a TODO), so it's left on the original header there.
  **Whoever builds the runner will hit the identical bug** and should
  extend the same `nonce`/`nextWithNonce` mechanism to the candidate
  branch of `middleware.ts` rather than rediscovering this. Non-production
  also needs `'unsafe-eval'` in `script-src` (Next dev mode's React
  Refresh/webpack HMR evaluates code strings) — added only when
  `NODE_ENV !== "production"`.
- **Real Supabase Auth calls are unverified in this sandbox** — same root
  cause as the foundation layer's unverified migration-version check and
  storage HEAD check (`IMPLEMENTATION_NOTES.md` above): no live Supabase
  project. `signInWithPassword`, `mfa.enroll`/`challengeAndVerify`, and
  `signOut` are implemented against the real `@supabase/ssr` + `supabase-js`
  APIs per the documented flow, but were never exercised against a real
  Auth server. What *is* verified end-to-end against this environment: the
  JWT-signature/`aal2` check and the DB allowlist check, by mounting a
  cookie in the exact shape `@supabase/ssr` stores (JSON, `base64-` prefixed,
  under a fixed cookie name — see below) with a locally-minted, correctly-
  signed HS256 JWT. `tests/e2e/admin-fixtures.ts`'s `addAdminCookie()` is
  this mechanism, used by every admin e2e test; the same technique was used
  ad hoc via a throwaway script for manual browser QA (not committed).
  Before a real deploy: manually walk `/admin/login` → password → TOTP QR →
  code against a real Supabase project once.
- **Cookie name is explicit (`sb-admin-auth-token`), not
  `@supabase/ssr`'s computed default** (`sb-<project-ref>-auth-token`,
  derived by parsing `SUPABASE_URL`). Passed via `cookieOptions.name` in
  `src/lib/supabase-admin-auth-client.ts`. This makes the cookie name stable
  and independent of the Supabase project URL shape, which matters both for
  `src/lib/admin-jwt.ts` (needs a fixed name to read in Edge middleware) and
  for minting test cookies without depending on a real project ref.

### Candidate list/detail

- **Keyset pagination for numeric/date sort columns, offset pagination for
  text columns** (`src/db/queries/candidates.ts`). `ADMIN_UX.md` §3 asks for
  keyset generically ("sort keys are denormalized... keyset on
  `(sort_key, application_id)`"). Building a correct keyset cursor for a
  multi-column, non-scalar sort like "last_name, first_name" or
  "institution, study_year" needs a compound-tuple comparison that's
  meaningfully more code for sorts that aren't the primary triage path (the
  default and quick filters all sort by `score_overall`/`pct_rank`/
  `applied_at`, which get full keyset treatment). Offset pagination for the
  three text sorts (name/stage/institution) is a scoped-down but correct
  choice at the stated volumes (hundreds–low thousands per job); flagged
  here rather than silently shipped as if it were the general case.
- **Bulk archive-and-delete runs synchronously, in-request, in batches of
  100** rather than as a resumable background job with a live progress bar
  (`ADMIN_UX.md` §3.5 literally describes "a progress bar; safe to
  interrupt"). Building an actual resumable job queue was out of proportion
  to this task's time budget and this app's "no background jobs, ever"
  architecture (`ARCHITECTURE.md` §1: "Background jobs / cron: **None**").
  What's built: the delete itself is genuinely safe to re-run (a candidate
  already deleted is silently absent from a re-resolved id list), and CSV
  export happens client-side before the delete call so the export always
  reflects pre-delete data — but there's no mid-flight progress UI, and a
  very large selection (thousands) will block on one request/response
  cycle. Worth a real background-job mechanism if selections regularly
  exceed a few hundred rows in practice.
- **`ignoreFocusSignals()`'s recompute is explicitly provisional**
  (`src/db/queries/candidate-mutations.ts`). The real logic for "what does
  ignoring focus signals do to the risk level" belongs in the assessment
  engine's `computeIntegrity()` (`src/assessment/integrity.ts`,
  `ANTI_CHEATING.md` §5), which is still `throw new Error(...)` as of this
  pass. Rather than leave the whole admin override feature unbuilt, a
  narrow heuristic is used (drop reasons coded `tab_hidden*`/`blur_only`/
  `instance_new`, re-sum remaining weight, threshold at 30/60) — clearly
  commented as provisional, with a pointer for whoever implements
  `computeIntegrity()` to replace it with a real "ignore focus" mode there
  instead.
- **Admin UI strings are hardcoded Hebrew, not routed through
  `messages/he.json`**, despite `ADMIN_UX.md` §1's "strings in
  messages/he.json." The admin UI is Hebrew-only at launch with no locale
  routing (`ARCHITECTURE.md` §9 confirms this, and the existing placeholder
  pages already hardcoded their Hebrew strings this way before this pass).
  Wiring ~150 admin strings through `next-intl`'s message-file mechanism
  without any locale routing to hang it off would have been a meaningfully
  larger, purely-mechanical task for no behavioral difference today; it's a
  contained, mechanical follow-up whenever English admin support becomes a
  real requirement (at which point every string needs extracting anyway,
  message-file or not).
- **Bank analytics (`ADMIN_UX.md` §6) is simplified**: no "צפה בדוגמה"
  sample-instance button and no median-time-used column, since both need
  `src/assessment/generator.ts`, which is still a stub. What's built (per-
  template served count/accuracy/skip-rate/expiry-rate, `admin_alerts`-
  flagged rows highlighted) is real and reads live `assessment_items`/
  `assessment_responses` data — it just has nothing to show yet in a fresh
  environment, which is the honest state, not a placeholder.

### Local testing / tooling

- **`scripts/dev-seed.sql`** is intentionally not a migration (doesn't go
  through `supabase/migrations/`) — it's a one-shot dev fixture, run as the
  Postgres superuser directly (bypasses RLS, unlike `app_user`), matching
  `local-pg-setup.sh`'s own pattern of being a dev-only stand-in.
- **`playwright.config.ts`'s port is now overridable via `PLAYWRIGHT_PORT`**
  (defaults to 3000, unchanged for anyone not setting it). This sandbox runs
  multiple worktrees/agents concurrently, and a hardcoded port meant this
  suite could silently attach to a *different* agent's dev server (same
  codebase, different/no seed data) instead of its own — actually observed
  once while testing, before spotting the cause. Not otherwise a functional
  change.
- **Do not run `./scripts/local-pg-setup.sh` (or anything that drops the
  DB) while a dev server is connected to it** — `postgres.js`'s pooled
  connections don't recover from their underlying database being dropped
  out from under them, and every query fails in ways that look like
  application bugs (empty lists, silent 200s) rather than a clear connection
  error until the dev server is restarted. Stop `pnpm dev` first, reset/
  reseed, then start it again.

## What was not run end-to-end

There is no live Supabase project in the environment this was built in, so
the migrations have not been executed against a real Postgres instance.
`pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `pnpm
build`, and a Playwright smoke test against `pnpm dev` all pass — see
`IMPLEMENTATION_STATE.md` for the exact commands run. Before the first real
deploy: run `supabase db push` against a real project and `supabase test
db` (the pgTAP smoke test in `supabase/tests/database/`), then work through
`README.md`'s setup steps.
