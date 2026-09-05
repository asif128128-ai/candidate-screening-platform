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
