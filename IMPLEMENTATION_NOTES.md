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

## Assessment engine — decisions made where the spec was silent or two readings were both plausible

Cross-linked from `IMPLEMENTATION_STATE.md`'s "Assessment engine" section.
Each of these is a place where `ASSESSMENT_DESIGN.md`/`SCORING.md`/
`ANTI_CHEATING.md` under-specified something the implementation had to pin
down. All are covered by unit tests (`tests/unit/assessment/*.test.ts`) so a
future change to any of them shows up as a failing, explainable test rather
than a silent drift.

**`guess_penalty` (SCORING.md §3.3) is session-wide, not investigation-block-scoped.**
The formula line reads "guess_penalty = min(6, 2 · guessed_items) // see 3.5;
includes blind guesses in this block", which reads two ways: (a) count only
guesses within the investigation block, or (b) count every guess in the
session (§3.5's single global "ניחושים: k" metric), with the parenthetical
just clarifying that investigation blind-guesses are folded into that same
count rather than tracked separately. **§10's own worked example decides
this**: its one guessed item is explicitly in the speed block, yet the
Independence score still takes the −2 penalty. Implemented as (b) — see
`scoreSession`'s `totalGuessedItems` in `scoring.ts`. This means a candidate
who guesses fast on a speed item pays a small Independence penalty too; that
is what the worked example requires, not a bug.

**A blind wrong guess zeroes the whole item's `s_i`, not just its correctness gate.**
§3.6 states "A blind wrong guess scores s_i = 0" as if it were a consequence
of the composite formula, but the literal 0.5/0.25/0.25 formula in §2 doesn't
gate on q1 — and the §10 worked example's scene B (wrong root cause, correct
action+fact, **not** blind) explicitly scores 0.5, proving the composite
formula alone doesn't zero non-blind wrong-q1 items. Read together, the only
consistent interpretation is: **when q1 is wrong AND the decisive artifact
was never opened, the whole item is forced to `s_i = 0`** (implemented as a
post-hoc override in `scoreSession`, after the process/decisive-artifact
computation, so it doesn't touch scene-B-shaped non-blind wrong answers).
Without this, the skip-never-worse-than-a-blind-guess invariant (§3.6) is
mathematically false in general — a lucky blind guess with q2/q3 both right
could outscore a skip (`I_correct` would favor the guess by up to ~16 points
for a difficulty-3 scene, more than the 6-point penalty cap can claw back).
With the override, the invariant holds structurally (skip and blind guess
both contribute `s_i = 0`; skip's process score is only ever ≥ the blind
guess's; only the guess incurs the penalty). See
`tests/unit/assessment/scoring.test.ts`'s `skip_dominates_blind_guess`
10,000-trial property test.

**Confidence (SCORING.md §5) counts an honest skip as "served and finalized".**
"items never served count as missing" implies the complement — served items,
whether answered, expired, or skipped — all count toward confidence. A skip
is an explicit candidate action (clicking "דלג/י"), not an absence of one.
Implemented in `scoreSession` accordingly; a session where the candidate
legitimately skipped one item and answered the other 26 has confidence 1.00,
not 0.96.

**Investigation `isCorrect` (the ✔/✘ shown per item, SCORING.md §8) is sub-question 1 only.**
The composite `s_i` is a fraction (0, 0.25, 0.5, 0.75, or 1); a single ✔/✘
glyph needs a boolean. Root cause (q1) is the headline judgment the pillar is
named for, so `scoreItem`'s `isCorrect` for `kind: 'investigation'` reflects
q1 specifically. `sI` (the 0.5/0.25/0.25 composite) is the value stored in
`assessment_responses.partial_credit` and used for all pillar-score math;
`isCorrect` is what's stored in `.is_correct` and used for guess detection's
generic "answered wrong" check and the item-table ✔/✘ column.

**Investigation sub-question 3 needs a per-scenario question text, not a generic prompt.**
`ASSESSMENT_DESIGN.md`'s worked example 6 shows a specific question ("מה
מספר ההזמנה הראשונה שנכשלה?"), not a boilerplate "extract the fact" prompt —
obvious in hindsight, easy to miss when building the shared
`buildInvestigationItem()` plumbing first. `bank/investigate/helpers.ts`'s
`VariantWorld` has a required `q3Prompt` field; every one of the 36 cause
variants sets its own. The bank-audit and generator tests both check that
`answerKey.q3CorrectText` appears verbatim in exactly its declared decisive
artifact and nowhere else among the scene's tabs — this caught (and this
session fixed) several first-draft variants where the fact incidentally also
appeared in a second, non-decisive tab or only in a differently-formatted
non-matching string.

**`conventions_stated` is per-generated-item, not purely per-template.**
`ASSESSMENT_DESIGN.md` §3/§4.4 describes it as a template-level declaration,
but several families (`tech.http_status_next`, `tech.api_pagination_math`,
`speed.timezone_shift`) embed a doc excerpt or stated rule whose *exact
text* varies by draw (which HTTP status was picked, what the offset is this
instance). `ItemTemplate.generate()`'s return type carries an optional
`conventionsStated` override; when present it replaces the template's static
declaration for that one generated item, and the bank audit's verbatim check
runs against whichever value actually applies. Templates whose embedded text
never varies (`speed.ip_valid`, `speed.regex_match`, `speed.path_resolve`,
`speed.units_math`, `speed.bool_logic`, `reasoning.state_machine`) just use
the static template-level string, which must then be an exact substring of
every instance's rendered prompt — this is why those templates share a
`RULE`/`LEGEND` constant between the declaration and the prompt text instead
of writing the sentence twice.

**Speed items are always difficulty 1.** `ASSESSMENT_DESIGN.md` §2's block
table gives reasoning/tech/investigate explicit per-session difficulty mixes
but says nothing for speed, and `SCORING.md` §3.4's speed formula never
multiplies by `DIFFICULTY_WEIGHT` at all (unlike every other pillar). Read
together this means speed has no difficulty axis in practice; `generator.ts`'s
`DIFFICULTY_MIX.speed` is ten 1s. The `difficulty` column is still populated
(the DB requires it, `1-3` check constraint) and technically feeds
`IMPOSSIBLE_TIMING`'s difficulty-3 check in `integrity.ts`, but no speed item
can ever trigger that branch as a result — an accepted, harmless consequence
of this reading, not a bug to fix.

**Which four (scenario, cause) pairs are escalation-required (DECISIONS_LOG.md #6).**
The decisions log names the *categories* ("rotating a shared secret owned by
another team", "paying for a plan upgrade", "a security incident",
"deleting a production resource") but not which scenarios instantiate them.
Chosen, one per category, spread across four different scenario families so
no single scenario always carries the session's escalation slot:
`investigate.webhook_missing` cause `c` (CRM API key owned by an external
vendor), `investigate.sso_login_subset` cause `c` (security-incident-driven
MFA policy), `investigate.backup_silently_failing` cause `b` (credential
rotated by another team), `investigate.saas_seat_limit` cause `a` (seat
upgrade needs budget authority). `generator.ts` guarantees at least one of a
session's 4 investigation slots lands on one of these four pairs — see
`INVESTIGATION_SCENARIOS[].escalationCauses` in `bank/index.ts` and the
forcing logic in `generateInvestigationBlock()`. The escalation-forcing
fixup deliberately swaps out the **most**-used cohort-balancing pick (not the
least-used one) when it has to substitute a scenario, so the two invariants
(escalation coverage, cohort balance) don't fight each other — see
`tests/unit/assessment/generator.test.ts`'s cohort-balancing test for the
regression guard.

**SVG option markup is excluded from the §4.4 "≤ 1,600 character" content budget.**
`reasoning.grid_pattern` renders its 6 options as inline `<svg>` strings per
`ASSESSMENT_DESIGN.md` §2.4; raw SVG source easily exceeds 1,600 characters
even though the on-screen visual is small. The budget is about reading load,
not byte count of a graphical asset the candidate never reads as text, so
`scripts/bank-audit.ts`'s character counter skips any string starting with
`<svg`. If a future template renders large inline SVG *and* has a genuinely
too-long textual prompt alongside it, this exclusion would hide that — worth
revisiting if grid_pattern-style templates multiply.

**Sample-size floors for the three new statistical sweep checks are not in the docs; chosen conservatively.**
`ARCHITECTURE.md` §10 names the checks ("last 50 servings", "first 50 vs.
most recent 50") but not a minimum-N floor before a young template/scenario
is judged at all. `0003_sweep_checks.sql` requires ≥ 50 servings for
`template_accuracy` (matches "last 50" literally), ≥ 20 for
`template_expiry_strong` (a smaller floor since "strong candidate" sessions
are a subset of all sessions and 50 of those could take a while for a new
template), and ≥ 100 for `scenario_drift` (so the first-50 and last-50
windows are guaranteed disjoint, never double-counting the same servings in
early rounds). All three are easy to tighten later; they're a floor against
false alarms on day one, not a claim of statistical rigor.

**`db_size` was left as a TODO, on purpose, not "forgotten".** The brief asked
for "the 4 currently-TODO sweep invariant checks... blocked on bank/results
data not existing yet" — `db_size` (`pg_database_size` vs. a plan threshold)
was never blocked on the bank or results pipeline; `run_maintenance_sweep()`
already calls `pg_database_size()` every run and stores it in
`maintenance.db_size_bytes`. What's missing is a *threshold* and a Settings-
page display, which `IMPLEMENTATION_STATE.md`'s original placeholder table
assigns to the admin-ui engineer alongside the rest of Settings — adding an
`admin_alerts` row for it here would mean guessing at a threshold value with
no UI to show it against, on infrastructure outside this engineer's scope.

**Excusal windows (ANTI_CHEATING.md §5.2) are per-item, not millisecond-precise interval overlap.**
The spec says a hidden/blur span is excused when it "overlaps a
network_retry or server_outage window". `integrity.ts` implements this as:
if an item has *any* `network_retry` event or `outageCreditMs > 0`, **all**
of that item's hidden/blur spans are excused, rather than computing exact
timestamp-range intersection between each span and each retry/outage event.
This is simpler and strictly more generous to the candidate (never under-
excuses); the only way it differs from precise overlap math is in the
vanishingly rare case where an item has both a genuine long hidden span *and*
an unrelated network retry that doesn't actually overlap it — a false
negative for integrity risk, not a false accusation. Revisit if the pilot
(TEST_STRATEGY.md §9) shows this matters at the volumes involved.
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

## Assessment-runner engineer's pass — the hot-path routes, the runner UI, and two real bugs found in the merged foundation layer

Everything named in the task (the three hot-path routes plus `start`, the
full runner UI, resilience, tests) is built and verified against a real
local Postgres, not just typechecked. Cross-linked from the matching new
section in `IMPLEMENTATION_STATE.md`; read that first for the file map.

### Two real bugs found in already-merged code while wiring this up

Both were found by actually running a session against real Postgres, not by
inspection — reinforcing why "click through it yourself" was in the task.

1. **`assessment_items.variant_seed bigint` cannot hold what `generator.ts`
   actually produces.** `rng.ts`'s `deriveItemSeed` is SplitMix64 exactly as
   ASSESSMENT_DESIGN.md §4.1 specifies, masked to the *full unsigned 64-bit*
   range. Postgres `bigint` is *signed* 64-bit (max `2^63-1`), so any seed
   with the top bit set — roughly half of them — failed the very first real
   `startAssessmentSession()` call with "value ... is out of range for type
   bigint", nondeterministically (whichever items happened to draw a
   high-bit seed). Fixed by widening the column to `numeric` in a new
   migration (`0006_variant_seed_widen.sql`), not by touching `rng.ts` —
   that module is frozen by the bank's 50-seed snapshot test and 1,000-seed
   property tests in `generator.test.ts`, and `variant_seed` is a display/
   audit column only (never read back anywhere in `src/`, content/answer_key
   are stored directly at generation time), so this was the correct side to
   fix. See that migration's own comment for the full reasoning.
2. **`application_stage_history` is `admin_only` RLS, but two stage
   transitions (`applied` → `assessment_started`, → `assessment_completed`)
   are system-driven and only ever run from `candidate`-context
   transactions** (the assessment hot path never runs as admin). The raw
   `UPDATE`/`INSERT` failed with "new row violates row-level security
   policy for table application_stage_history". Fixed the same way
   `finalize_session`/`cv_upsert`/`apply_outage_credit` already solve this
   exact shape of problem: a narrow `SECURITY DEFINER` function
   (`assessment_mark_stage`, `0007_assessment_stage_transitions.sql`)
   that's the one path allowed to make this specific write from candidate
   context — and, importantly, runs *inside the caller's own transaction*
   (unlike calling out to a separate `withSystem` connection, which
   wouldn't be atomic with the surrounding session-creation/finalization
   work).

Both were caught immediately by `tests/integration/assessment-runner.test.ts`
against the local Postgres stand-in — first-run integration testing against
a real database earns its keep.

### A third bug: `scoreSession` had no public way to hand back what the spec's own interface note asked for

IMPLEMENTATION_STATE.md's interface note says `computeIntegrity`'s
`IntegrityResponse.decisiveArtifactOpened` "should come from `scoreSession`'s
per-item process computation (not recomputed)" — but `scoreSession`'s
`ItemBreakdown` return type had no field carrying it; the value was computed
internally (`computeProcessScore`, not exported) and discarded. Since this
is a genuine unsatisfiable-as-written cross-module contract (not a design
disagreement), I treated it as the "actual bug" the task's ground rules
allow fixing in `src/assessment/*.ts`: added an optional
`decisiveArtifactOpened?: boolean` field to `ItemBreakdown`, populated only
for investigation items, plus a regression test in `scoring.test.ts`
(`exposes per-item decisiveArtifactOpened in the breakdown for investigation
items only`) reusing the existing §10 worked-example fixture. Purely
additive; every existing scoring test still passes unmodified.

### The one-round-trip-per-answer vs. block-intro-screens tension

ARCHITECTURE.md §5.2 is explicit that `POST /answer`'s response "includes
the next item (so a transition costs one round-trip)". ASSESSMENT_DESIGN.md
§2 is equally explicit that block-intro screens (and the pre-investigation
practice scene) are shown *before* a new block's first item is served, with
its clock starting only once the candidate proceeds. Both can't literally be
true across a block boundary if "serve" and "start the clock" are the same
DB write (they are, by design — that's what makes refresh-safety work).

Resolution: `submitAnswer` now returns a third result kind,
`block_boundary` (`{ nextBlockKey, nextPosition }`), instead of auto-serving
the next item, whenever the freshly-finalized item's `block_key` differs
from the upcoming pending item's `block_key`. The item stays `pending`
(unserved, no clock) until the client — having shown the intro/practice
screen and gotten the candidate to proceed — calls the ordinary `GET
/current`, which serves it exactly the way it always serves the lowest
pending item. This keeps the "one round trip" property for every
*within-block* transition (23 of 27 items) and only spends an extra,
cheap round trip at the 3 real block boundaries, which is exactly where the
product wants a deliberate pause anyway. One accepted edge case: a hard
reload *during* the intro/practice gate (session sitting on a still-`pending`
item) will skip the intro on resume, since `GET /current` unconditionally
serves the lowest pending item — the candidate loses the intro screen, not
any scored time, so this was judged an acceptable trade rather than adding
a "session is gated on an intro" server-side flag for a purely cosmetic
screen.

The very first block (position 1, "speed") has no preceding answer to hang
a `block_boundary` off of, so it's gated client-side instead: the runner
checks `sessionStorage` for an "intro already shown" flag before ever
calling `GET /current` for the first time in a browser tab, and only calls
it once the candidate proceeds past the intro. This flag (and the
practice-scene-seen flag) live in `sessionStorage`, not React state, so a
same-tab reload mid-block doesn't re-show an intro the candidate already
dismissed, but a genuinely fresh start (new tab or first load) always shows
it once.

Because of this design, the runner needs to know a block's *shape* (name,
item count, per-item time limit, rules copy) before ever asking the server
for anything — there is no "peek" endpoint, deliberately, since serving and
clock-starting are inseparable. `src/lib/assessment-block-copy.ts` hardcodes
the seed blueprint's fixed block order and position ranges (1-10 speed,
11-16 reasoning, 17-23 tech, 24-27 investigate) for exactly this reason,
mirroring the same coupling `generator.ts`'s own `DIFFICULTY_MIX` table
already has to the blueprint's block shape. If a future blueprint changes
block composition, both tables need updating together — this is a "one
config, know its shape" constraint, not a scalability concern (`DATA_MODEL.md`
§3.3 ships exactly one config today).

### Rendering the bank's embedded tables and code fences

Found by actually running a session end-to-end (not from the spec, which is
silent on this): several templates — `speed.table_lookup`,
`tech.sql_outcome`, `tech.minimal_access`, `reasoning.table_must_be_true`/
`pseudocode_trace`/`rule_induction`, `speed.json_diff`, `tech.cloud_waste`/
`field_mapping_error` — embed markdown-style pipe tables and/or fenced
` ``` ` code blocks directly inside `content.prompt`/`content.ticket`
strings (e.g. `tech.sql_outcome`'s prompt is a pipe table, then a fenced
`sql` block, then the question, all in one string). There is no separate
"table" or "code" field in `ItemContent`, and no documented client-rendering
contract for this. Rendering `prompt` as plain text (my first pass) showed
literal `| id | עיר |` / `|---|---|` pipe characters to the candidate —
technically readable with effort, but well below the product's quality bar
for a professional-looking assessment, and arguably a small fairness issue
(non-native-Hebrew-reading candidates, already a named margin concern in
ASSESSMENT_DESIGN.md §2.2, have less slack to parse raw markdown syntax).

Fixed with a small, dependency-free renderer
(`.../assessment/item-text.tsx`, `<ItemText text={...}>`), same reasoning as
`renderJobDescriptionHtml` in `src/db/queries/jobs.ts` (no runtime markdown
library, per ARCHITECTURE.md §7's bundle budget): splits fenced code blocks
out first (rendered as monospace `dir="ltr"` blocks, matching ASSESSMENT_
DESIGN.md §5's "code blocks in JetBrains Mono... dir=ltr" — actually
`font-mono`, since self-hosting a second font family for a handful of code
blocks isn't worth the bundle cost; Tailwind's `font-mono` stack is a
reasonable substitute here), then detects pipe-table blocks in the
remaining text and renders them as real `<table>` elements (`dir="ltr"`,
since these tables mix Hebrew headers with technical/numeric cells and a
stable left-to-right column order was judged clearer than flipping it),
everything else as paragraphs with `\n`→`<br/>`-equivalent handling and
`**bold**` support. Verified visually (screenshots) against real generated
items for `speed.table_lookup`, `tech.minimal_access`, `tech.sql_outcome`,
and `reasoning.table_must_be_true`.

### Session-level telemetry simplifications (documented, not hidden)

- **`instance_conflict` "recent activity" check** uses
  `assessment_sessions.updated_at` (touched by Postgres on any row UPDATE)
  as a proxy for "was the previous `client_instance_id` active in the last
  30s", rather than a dedicated per-instance last-seen table. This is an
  approximation — `updated_at` also moves on unrelated session-row updates
  (e.g. `current_position` bumps from the *same* instance) — but those only
  ever make the window look *more* recent, never less, so the check can
  false-positive toward "conflict" slightly more often than a precise
  per-instance clock would, never the reverse; given `instance_conflict`
  only raises `INSTANCE_OR_DEVICE` (weight 10 of 100) and the admin-facing
  wording is descriptive ("access from two devices/tabs detected"), not
  accusatory, this was judged an acceptable simplification over a schema
  addition.
- **IP-change detection stores only the truncated prefix**
  (`assessment_sessions.last_ip_prefix text`, `0005_assessment_runner_
  support.sql`), never a full IP, so this new column needs no retention-
  sweep entry of its own — ARCHITECTURE.md §6's "full IP only ever lives on
  `integrity_events`, everywhere else is truncated" rule extends cleanly to
  it. The actual `ip_change` integrity event still carries the request's
  full IP on its own row (90-day-then-null, same as every other integrity
  event), same as before.
- **Clock-skew-jump detection** (`clock_anomaly`) similarly needs a "last
  measured skew" per session (`assessment_sessions.last_skew_ms integer`,
  same migration) rather than querying the latest such event each request.

### `ITEM_TOKEN_SECRET` — a new secret, deliberately separate from `CANDIDATE_COOKIE_SECRET`

ARCHITECTURE.md §5.2/§6 specifies the per-serve `item_token` as an HMAC but
never names which key. `src/lib/item-token.ts` (already implemented,
pre-dating this pass) takes an arbitrary `secret: string` parameter, so
reusing `CANDIDATE_COOKIE_SECRET` was an option. Used a new
`ITEM_TOKEN_SECRET` instead: it protects a different, much shorter-lived
thing (one item's answer window vs. a 14-day session identity), and
rotating one should never have to invalidate the other. Added to
`env.ts`'s schema, `.env.example`, and `render.yaml` (`generateValue: true`,
same as the cookie secret).

### Server outage credit: boot check moved out of `instrumentation.ts`

ARCHITECTURE.md §5.2 says the outage-window check runs "at boot, before the
process starts listening." I first wired it into `instrumentation.ts`'s
`register()` (dynamically importing `src/db/postgres.ts`), which broke
`pnpm build`: Next.js compiles `instrumentation.ts` for *both* the nodejs
and edge runtimes, and the `postgres` package needs real node
`net`/`tls`/`crypto`/`stream`, which don't exist for the edge bundle target
— failing even behind a `NEXT_RUNTIME === "nodejs"` guard, since that guard
is only knowable at *runtime*, not *build time* (webpack still has to
resolve the edge bundle's import graph). Moved the check
(`src/lib/outage-boot-check.ts`, `ensureOutageBootCheckRan()`) to run
lazily, memoized, on the *first* call to any of the three hot-path
functions (`startAssessmentSession`/`getCurrentItem`/`submitAnswer`) —
those are guaranteed Node-runtime (they import `postgres`/`node:crypto`
directly) and the check is still awaited synchronously before any of that
request's own DB work, so the ordering guarantee ARCHITECTURE.md cares
about (credit applied before anything reads/writes the affected items)
still holds. Scoping note: `liveness` is only touched by these same three
hot-path functions, not by every request in the app — sufficient for what
this feature protects (candidates mid-item during downtime), since a gap
only matters exactly when the hot path is being hit.

### Assumed `POST /api/assessment/start` contract: matched exactly, with one narrow, documented deviation

Implemented precisely against the candidate-flow engineer's assumed
contract (IMPLEMENTATION_STATE.md), with one deliberate deviation: an
already-`in_progress` session returns `200 { applicationId, redirectTo }`
(idempotent-ok) rather than `409 { error: "already_started" }`. Reasoning:
the briefing page's "מתחילים" button can legitimately be clicked again
after a reload of the briefing step itself (before the client ever
navigates away), and there is nothing wrong to report in that case — it's
the same "refresh doesn't lose progress" guarantee the rest of the runner
promises, just one step earlier. `409` is reserved for the genuinely
terminal case (`completed`/`abandoned`). Updated `briefing-panel.tsx`'s own
comment to match; `startAssessmentSession`'s doc comment states this
explicitly.

### Fixed a regression in `tests/e2e/candidate-flow.spec.ts` caused by this pass

That suite's step-3 test used to mock `POST /api/assessment/start` via
`page.route()` (documented as temporary, since the route didn't exist yet).
Now that a real, guarded `/apply/{id}/assessment` page exists, the mocked
200 response (which never actually writes a session row) got the candidate
bounced straight back to `/briefing` by the real page's own step-order
guard — correct behavior for a real request, but it broke the test, which
still expected to land on `/assessment`. Fixed by removing the mock
entirely and exercising the real endpoint (strictly better coverage), and
updating the subsequent resume-flow assertion, which now correctly expects
resume to land on `/assessment` (a real `in_progress` session exists) rather
than `/briefing`. See that file's updated comments.

### Headless Chromium does not fire `visibilitychange`/blur/focus across `page.bringToFront()` in this environment

TEST_STRATEGY.md §5 calls for testing tab-switch integrity signals via "a
second page in the same context and `page.bringToFront()`, not a synthetic
dispatched event." Implemented exactly that
(`tests/e2e/assessment-runner.spec.ts`), then verified directly (a
throwaway page with only `visibilitychange`/`blur`/`focus` listeners
attached recorded *zero* events across a `bringToFront()` round trip in
this headless environment) that this technique produces no events at all
here — a known headless/no-real-window-manager gap, not an app bug (the
same runner code correctly logs `visibility_hidden`/`window_blur` when a
real person actually switches tabs; only headless automation's simulated
focus doesn't propagate the same way). The test keeps the real
`bringToFront()` attempt (so it starts passing for free the moment this
environment or Playwright's headless focus handling improves) but logs a
note instead of asserting on it, and asserts the *reliable* half of the
same "integrity events beyond first_interaction get recorded" claim instead
— `contextmenu`/`copy_attempt`, which fire from direct interaction with the
current page and need no cross-page focus change. The DB-layer integration
test (`tests/integration/assessment-runner.test.ts`) already proves
`visibility_hidden`/`visibility_visible` insert and round-trip correctly
when the events genuinely arrive at the API — this e2e gap is specifically
about the *browser* not producing them in headless mode, not about the
server-side handling.

### e2e flakiness: same root cause as the pre-existing "dev-mode Server Action slowness" note above

`tests/e2e/assessment-runner.spec.ts`'s full-27-item-run test intermittently
(observed ~1 in 4-5 runs) fails a single click on a freshly-rendered item
with a Playwright actionability/timeout error, immediately after a
different item answered correctly moments before — never a *scoring* or
*security* failure, always a UI-interaction timing one, and never
reproduced outside `next dev`. This lines up with this file's own earlier,
pre-existing "dev-mode Server Action slowness" finding (`pnpm dev`
occasionally taking 30-90+ seconds to finish a server-action round trip for
reasons outside application code, resolved by using `pnpm build && pnpm
start` instead — not flipped in `playwright.config.ts` by that engineer's
own judgment call, left for whoever owns CI readiness). `answerCurrentItem`
now retries a missed selection once and fails fast (5s) instead of hanging
for the full test timeout, and 2 of 3 repeated runs of the full-27-item test
passed cleanly with the retry in place; the manual, non-Playwright
verification (real-browser console session, `manual-check.mjs`-style,
described in `IMPLEMENTATION_STATE.md`) completed multiple full 27-item runs
including all four investigation items with zero stuck interactions,
confirming the runner's actual application logic is not the source. I did
not flip `webServer` to `pnpm build && pnpm start` myself, same reasoning as
the existing note: that's a shared CI-config decision bigger than one
engineer's pass, now doubly true with a second, heavier real-Postgres e2e
suite added on top.

### What was and wasn't run for this pass

Run and verified (see `IMPLEMENTATION_STATE.md` for exact commands/counts):
`pnpm typecheck`, `pnpm lint`, `pnpm test` (unit, no DB), `pnpm test` against
a real local Postgres (unit + all integration suites, including this pass's
new `tests/integration/assessment-runner.test.ts`), `pnpm build`, the new
`tests/e2e/assessment-runner.spec.ts` (chromium), and the full existing
`tests/e2e/candidate-flow.spec.ts` + `smoke.spec.ts` + all four
`admin-*.spec.ts` suites (chromium) — confirming no regression in
foundation-layer or other engineers' work. Plus extensive manual click-
through against `pnpm dev` and real Postgres: multiple complete 27-item
runs (screenshots taken and visually reviewed for every item kind including
investigation's artifact-tab UI, block-intro screens, and the practice
scene), confirmed real integrity telemetry rows in the DB
(`first_interaction`×27, `answer_change`, `artifact_open`, `instance_new`)
and a real computed `assessment_results` row with a plausible
`integrity_risk`.

**Not run**: `pnpm bank:audit` (assessment-engine's own milestone, unrelated
to this pass); the nightly full Playwright matrix on firefox/webkit/mobile
(same rate-limit-budget reasoning as the candidate-flow engineer's note
above, now compounded by this pass's own real-signup e2e suite — recommend
running the full matrix in CI once it has its own disposable Postgres, not
shared with local manual testing); k6 load scenarios (pre-launch, explicitly
out of any single engineer's milestone per `TEST_STRATEGY.md` §8);
`supabase test db`/pgTAP (no Supabase CLI in this environment, same
constraint every other pass in this file already documents).

## Red-team fix pass — two scoring-integrity bugs (bank difficulty scaling, independence process score)

Cross-linked from `IMPLEMENTATION_STATE.md`'s new "Red-team review" section.
Both fixes are inside the existing `src/assessment/*` architecture; no
schema, generator, or scoring-formula-shape changes.

### Finding #1: why "add real scaling" instead of "narrow `difficulties`"

The brief explicitly offered narrowing a template's declared `difficulties`
array as the fallback when real scaling isn't sensible for a given
template. I used it for exactly one template (`tech.git_what_happened`,
whose declared range was already `[2, 3]` before this pass, unchanged) and
implemented real scaling everywhere else, because:

- Every affected template already had ASSESSMENT_DESIGN.md's `pool` string
  matching its whole pillar (`tech.*` / `reasoning.*`), and
  `generator.ts`'s `DIFFICULTY_MIX` requires several *distinct* eligible
  templates per difficulty level per block (tech needs d1×2/d2×4/d3×1;
  reasoning needs d1×2/d2×3/d3×1) with a "no repeat family in one session"
  rule on top. Narrowing even 2-3 of the 11 tech templates down to a single
  difficulty each would have measurably thinned the d2 pool (already the
  block's largest requirement) and made `pickTemplatesForBlock`'s fallback
  path (which clamps to a template's nearest *supported* difficulty when no
  template declares the exact one requested) fire more often — silently
  reintroducing a version of the same bug (an item labeled d3 that's
  actually a template's d2 content) rather than fixing it.
- DECISIONS_LOG #7 already flags scenario/template exposure margin as
  tight; narrowing directly shrinks it further (fewer distinct instances
  per difficulty slot = fewer things a leaked answer needs to cover to be
  useful across a whole difficulty tier).
- In every case I could find a genuine, pillar-appropriate difficulty axis
  (see the per-template list in IMPLEMENTATION_STATE.md) without changing
  what kind of item the template is — e.g. a table gets more rows and a
  compound predicate, a judgment call gets a subtler decoy, a lookup gets a
  less-common status code — which is squarely "the convention is in the
  item" applied to difficulty rather than to recall (DECISIONS_LOG #8).

Where a pool of cases was small (e.g. `tech.automation_pick` had 4 cases
total for `[1, 2]`; `tech.data_normalize` had 3 for `[1, 2]`), I added new
cases to the easier and/or harder tier rather than just repartitioning the
existing ones 1:1 into "easy half" / "hard half" — repartitioning would
have *reduced* each tier's variety versus the buggy-but-varied baseline,
which is exactly the DECISIONS_LOG #7 tradeoff the brief asked me to avoid
tilting the wrong way.

**A note on the "genuinely scaling" reference templates.** The brief named
`tech.sql_outcome`, `tech.api_pagination_math`, and `tech.log_root_cause` as
the model for real scaling and explicitly excluded them from the fix list.
Reading them closely: `sql_outcome` scales all 3 levels distinctly (COUNT ->
SUM+WHERE -> GROUP BY HAVING). `api_pagination_math` and `log_root_cause`
each only distinguish d1 from a combined d2/d3 tier (i.e. their own d2 and
d3 outputs are drawn from the same branch and are not distinguishable from
each other) — so by the letter of "every difficulty level must actually
differ," these two are not fully fixed either. I left them alone: the brief
named them as the reference standard and out of scope, narrowing my own
list to exactly what was asked rather than second-guessing the review's
scope boundary. Flagging it here in case a future pass wants to tighten
those two the same way (fold their `difficulties` to `[1, 2]`, or add a
genuine third tier).

### Finding #2: the mechanism chosen for the process-score fix, and residual risk

Read `scoring.ts`'s `computeProcessScore`, `types.ts`'s
`InvestigationAnswerKey`/`InvestigationContent`, and three `investigate/*.ts`
scenario files (`webhook_missing.ts`, plus two others) before deciding.
Confirmed there is genuinely no existing schema hook to wire a
comprehension check into: `InvestigationContent` has exactly `q1` (root
cause), `q2` (next action), `q3` (extract-a-fact short text) — no
sub-question is tied specifically to "what does the decisive artifact tell
you," and `ScoringEvent`'s only two kinds are `artifact_open` and
`network_retry` (no scroll/expand/detail-toggle telemetry exists in the
data model or is emitted by the runner UI). Adding either would be a real
schema change (new DB column or a new client-emitted event kind wired
through the runner UI, `POST /api/assessment/events`, and
`integrity_events`) — out of scope for a scoring.ts-level fix per the
brief's own guidance to prefer the cheaper, schema-compatible signal.

**Chosen mechanism**: full evidence credit (the 0.5-weight component) now
requires `decisiveOpened && (decisiveDwellMs >= 8000 || distinctArtifactsOpened >= 2)`,
instead of the old `decisiveOpened` alone (where "opened" already meant
>= 3000ms dwell). Two independent, either-is-enough signals:

1. **A much longer solo dwell** (8s, not 3s). A dwell of "just over 3
   seconds" is exactly what a fixed instruction ("wait 3 seconds") produces
   — it is a round number with no connection to the actual artifact's
   content. Requiring roughly 2.5x that is still trivially satisfiable by
   an honest candidate who is actually reading a short artifact body (most
   decisive artifacts in the bank are 1-6 short lines), but requires a
   leaked script to also specify a materially longer, less "invisible"
   wait — raising the cost/detectability of the exploit rather than the
   marginal effort of complying with it.
2. **Touching a second artifact.** A candidate who opens even one other
   tab (any dwell) alongside the decisive one is doing something a
   leaked "open exactly tab X" instruction has no reason to include —
   real investigation naturally samples more than one source before
   committing to an answer.

I deliberately did **not** gate this on `item.artifactKeys.length` (i.e.
requiring opening a *specific fraction* of tabs) — that would conflate this
fix with the existing click-through penalty (opening literally every tab
in <15s already caps `efficiency` at 0.3, per SCORING.md §3.3), and
double-penalizing the same behavior through two different components would
make the process score harder to reason about without adding a distinct
signal.

**Why `decisiveArtifactOpened` (returned from `computeProcessScore`,
feeding both `computeGuesses`'s blind-guess check and
`ItemBreakdown.decisiveArtifactOpened`) is intentionally NOT tightened the
same way.** Blind-guess detection asks a different question — "did the
candidate look at the evidence at all before answering wrong" — not "did
they investigate thoroughly." Tightening it to the new 8s/second-tab bar
would reclassify a candidate who wrong-root-caused after a brief-but-real
3-4 second glance at the decisive tab as a *blind* guess, incorrectly
zeroing their q2/q3 credit and applying the guess penalty (SCORING.md
§3.6) — a behavior change to a different, already-carefully-tested
invariant (`skip_dominates_blind_guess`, 10,000-trial property test) that
finding #2 does not ask me to touch. Keeping the two concepts on separate
variables (`decisiveOpened` vs. the new `evidenceQualified` gate) was the
key design choice that let both fixes coexist without the SCORING.md §10
worked example's numbers moving at all — every scene in that worked
example dwells far longer than 8 seconds, so the regression test is a
genuine unmodified check, not one I had to adjust to pass.

**Residual gaming risk** (per the brief: the goal is "meaningfully harder
to fake," not "unbeatable," given DECISIONS_LOG #7's small scenario pool):
a sufficiently detailed leak that specifies *both* "open tab X" *and*
"also open tab Y" (or "wait 8+ seconds") still produces full evidence
credit with no real comprehension — this fix raises the bar on what the
leaked script must contain and how it behaves (a longer idle wait or a
second navigation event, either more noticeable / harder to script blindly
than a single fixed 3-second pause), it does not make evidence-forging
impossible. A genuine sub-question comprehension check tied to the
decisive artifact (the schema-change option the brief flagged as larger
scope) would close this residual gap and is worth doing if leak-and-farm
gaming shows up in real pilot data (the `scenario_drift` alert added by an
earlier pass, per DECISIONS_LOG #7's mitigations list, would be the
detection signal to watch for this).

## Fable's final holistic review — two fixes landed, three caveats accepted as-is

Fable's final fresh-context review (see IMPLEMENTATION_STATE.md) found two
"fake precision" bugs, both now fixed (see that section for the fix
details and proving tests): `admin_application_rows.pct_rank` ranking
against every application instead of only scored ones, and the "overdue"
header count including applications that never reached the assessment.

Fable explicitly separated those two ("must fix before a real deployment")
from three others it labeled "caveats to schedule but not block on." Given
the scope of everything else already fixed in this review cycle, those
three are being left as documented, accepted follow-ups rather than fixed
now — closing them is straightforward but each touches a different part of
the system (outage-credit semantics, client state, a display constant) and
none is a correctness or security defect, unlike everything else this
review cycle addressed:

1. **Outage-credit measures process idle time, not actual downtime.**
   `liveness` is only touched by the three assessment hot-path functions,
   and the boot check runs on the first hot-path request of a process
   (`outage-boot-check.ts`). After a redeploy following a quiet stretch
   (no candidate mid-assessment), the "gap" since the last hot-path call
   can be hours even though the service was never actually down — crediting
   nobody in practice (there's no live session to credit) but still writing
   a `server_outage` integrity event and firing the `outage_credit`
   sweep alert/Sentry event as if a real outage occurred. Conversely, a
   genuine Supabase-side outage while the Node process itself stays up
   never gets detected at all (`liveness` was never stale from the app's
   own point of view). Both directions are cosmetic-alert-noise-or-silence,
   not data corruption — no candidate's actual timer is ever wrongly
   docked or credited by this, since crediting only ever extends a
   currently-live item's deadline, never shortens one. A more accurate
   design would need a real external heartbeat/uptime source instead of
   inferring downtime from the app's own request pattern — worth doing if
   the false `outage_credit` alerts turn out to be frequent enough in
   practice to be annoying, not before.
2. **Block-boundary UI state (intro screens, the practice scene) is
   client-only, tracked in `sessionStorage`.** A refresh, crash, or
   resume-code re-entry landing exactly on a fresh block boundary serves
   the next item directly via `GET /current` (which always serves the
   lowest pending item, correctly, per its refresh-safety contract) without
   re-showing that block's intro/practice screen. This was already an
   accepted trade-off from the original assessment-runner pass (see that
   section above, "The one-round-trip-per-answer vs. block-intro-screens
   tension") — the candidate loses a cosmetic orientation screen, never any
   scored time or a changed deadline. Fable's review re-surfaced it as
   still-open, not as a new finding; still true that this only matters for
   the narrow case of a crash/resume landing exactly on a block's first
   item, and still judged not worth a server-side "session is gated on an
   intro" flag for a screen with no scoring consequence.
3. **The DB-size warning threshold (70%/90% of the Supabase plan's included
   storage) is a literal constant in both `evaluate_db_size_alert()`
   (SQL, migration `0011_db_size_sweep_check.sql`) and
   `DB_PLAN_BYTES`/`DB_SIZE_WARNING_FRACTION` (`src/lib/admin-format.ts`).**
   Two sources of truth for a number that only ever changes if the Supabase
   plan itself changes (a rare, deliberate, human-driven event — upgrading
   plans is not something that happens by accident). Worth collapsing to
   one source (e.g., an app-config row the SQL function reads, or
   generating the SQL constant from the TS one at migration-write time) if
   the plan is ever actually upgraded and someone has to remember to update
   both places — not worth the added complexity (a new config table, or a
   codegen step) to prevent a mistake that requires a human to already be
   mid-plan-upgrade to make.

## Genuine-reasoning fix pass — reasoning behind the three findings

Cross-linked from IMPLEMENTATION_STATE.md's new top section. This entry
covers the judgment calls that section only summarizes.

### Why length-balancing was done by measurement, not by feel

Early in this pass I rewrote every flagged distractor to be longer and more
detailed, re-ran the new bank-audit invariant, and found roughly 20 of the
~50 flagged template/scenario slots *still* failed — some at exactly 100%
still, a few flipped all the way to 0% (a mirror-image bug: the correct
answer had become the *shortest* option, every time, which would just hand
a "pick the shortest" bot the identical win). The lesson: "write it longer"
is not the same fix as "make length uninformative." Two options read as
similarly detailed to *me* can differ by 10-30 raw characters, and because
most of these options are static strings (no per-instance randomization in
the text itself), that fixed gap makes the length ordering deterministic
across every single generated instance, not just "usually" — a 100%-vs-0%
pattern is exactly as exploitable as a 100%-vs-100% one, just in the
opposite direction. Once I noticed this I switched to closing the loop with
a throwaway measurement script (`diag2.ts`/`diag3.ts`-style, not committed
— they call the exported `scenario.generate`/`template.generate` directly
against many seeds and report the unique-longest-is-correct rate) after
every edit, iterating the specific gap in characters rather than guessing.
The bank-audit's own new invariant, run at full scale, is the real
end-state proof; the throwaway scripts were just how I got there without
burning a 20,000-session audit run per edit.

One consequence worth flagging for whoever touches this content next:
because the fix targeted *length parity*, not a stronger content
constraint, a future editor who lengthens one option in an existing item
(even for an unrelated readability reason) can silently reintroduce a
100%-or-0% pattern for that one slot. The bank-audit invariant will catch
it (that's exactly what it's for), but the failure will look like "some
distractor is now too short/long" rather than anything about correctness —
worth knowing so it doesn't read as a mysterious CI failure.

### Independence process score, round two: why `deliberation` didn't need a new formula

The brief flagged `deliberation` as "effectively a constant 1... for the
same root reason" as the evidence-farming bug, and asked me to either
re-derive its logic or drop it and redistribute its weight, with the
tradeoff documented here regardless of which I picked.

I read `computeProcessScore` closely before deciding. `deliberation`'s
definition is `firstOpenMs !== null && firstAnswerMs !== null && firstOpenMs
< firstAnswerMs` — literally "was any artifact opened before any answer was
selected." That is a real, meaningful question; it was answering `true`
100% of the time only because `firstOpenMs` was *always* ~0 (the mount-time
auto-open, Finding B) and `firstAnswerMs` is necessarily positive (a human
or bot needs at least one tick of clock time to read the ticket and click
something). In other words: the formula was fine, its only input was
corrupted at the source.

I confirmed this isn't wishful thinking by tracing where `firstAnswerMs`
actually comes from: `computeProcessScore` reads
`response.firstAnswerSelectMs ?? response.firstInteractionMs`.
`firstAnswerSelectMs` is declared in `ScoringResponse` but is **never
populated** anywhere in the real pipeline (`src/db/queries/assessment.ts`
only ever sets `firstInteractionMs` when building `ScoringResponse` from
stored rows) — so in production this always falls back to
`firstInteractionMs`. And `firstInteractionMs` is recorded by
`telemetry.recordFirstInteraction()`, called from exactly one place in
`runner.tsx`: `handleAnswerChange`, which fires only when the candidate
changes a q1/q2/q3 answer — never from `handleArtifactOpen`. So
`firstInteractionMs` for an investigation item already means, specifically,
"time of the first real answer selection," distinct from any artifact
interaction. Once Finding B's fix stops fabricating an open at mount,
`firstOpenMs` becomes "time of the first genuine tab click" and the
comparison the formula makes is exactly the one it was designed to make.

I verified this isn't just theoretically clean by checking what happens to
a candidate who never touches a tab at all (reads only the always-visible
default view and answers directly): `firstOpenMs` is now `null`, so
`deliberation` correctly scores 0 — no events, no fabricated credit.

**The tradeoff I'm documenting, as asked**: `deliberation` remains a coarse
signal even now — it doesn't require the candidate to have opened *the
decisive* artifact, dwelt on it, or opened more than one tab; any click on
any tab before answering satisfies it. A candidate coached with "click any
tab once, then answer" still earns full deliberation credit trivially.
I judged this an acceptable residual (not a new decision to defer) for two
reasons: first, it's now on par with the rest of the process score's
general design philosophy — `evidence` and `efficiency` also key off "was
X opened," not "did the candidate demonstrably comprehend X"; deliberation
being similarly coarse doesn't introduce a new class of weakness, it just
stops being uniquely and totally broken. Second, the exploit surface
shrank from "do absolutely nothing" (Finding B's actual complaint) to
"perform at least one deliberate click" — a real behavioral floor that a
script has to actually contain an instruction for, rather than something
that happens by construction on every single scene regardless of what the
candidate does. Given that floor is now non-trivial, I did not see a
clean, schema-compatible way to make deliberation additionally require
touching the *decisive* artifact specifically (that would just collapse it
into a duplicate of `evidence`/`efficiency` rather than measuring a
distinct thing — "explored before deciding" vs. "explored the right
thing"), so I left the formula as-is rather than manufacturing a
distinction that isn't really there. If a future pass wants to make
`deliberation` require touching 2+ distinct artifacts before answering (to
more clearly separate it from `evidence`'s single-artifact-focused
signal), that's a one-line change to the existing formula (compare against
the second element of a per-position distinct-artifact list instead of the
first `artifact_open`) and does not require new client-emitted event kinds
or a schema change — flagging it here as the natural next increment if
real pilot data shows this residual is being exploited.

### sql_outcome and constraints_seating: why "reroll" over "add NULL as an option"

For `tech.sql_outcome`, the brief offered two options: reroll until at
least one row matches, or make NULL a valid, correctly-keyed option. I
picked reroll because it's strictly simpler here — the row-generation and
answer-key code already has to enumerate the actually-generated rows to
compute `correctValue`, so restricting the `(team, status)` pick to
combinations *present in that enumeration* is a few lines with no new
answer-key shape, no new rendering case for "NULL" in the options list,
and no risk of a distractor generator (`generateDistinctDistractors`, which
assumes numeric-ish string distractors) needing a special case for a
non-numeric correct answer. The "NULL as a valid option" path is the more
SQL-faithful lesson in the abstract (it teaches something about NULL
semantics that "always at least one row" doesn't), but it's a second,
independent template variant to design, write distractors for, and
balance for Finding-A length parity — more scope than the finding asked
for when the simpler fix fully closes the "measures nothing / actively
wrong" defect.

For `constraints_seating`, I initially considered the minimal patch (add
one more constraint type to the existing hardcoded pool and force it into
the mix), but reading `buildConstraints` closely showed the deeper problem:
the pool was fundamentally too small and too coupled to a single fixed
shuffle of five roles (`a, b, c, d, e`) to reliably satisfy a *forced-unique*
subset for a *given* difficulty's constraint count — that's precisely why
the original code needed a "if nothing works after 200 tries, fall back to
a guaranteed chain" escape hatch, and that escape hatch is exactly what the
review caught. A minimal patch would have reduced how often the fallback
fires without eliminating it, leaving a residual (if rarer) chance of the
same bug reappearing. Generating the constraint pool *from the target
seating order itself* (rather than from arbitrarily-shuffled role labels)
means the pool scales with `n` and is always rich enough — verified
empirically (0.0% pure-adjacency-chain rate, zero thrown invariant
violations, over 20,000 instances per difficulty) rather than argued from
first principles, which is why I also left the hard runtime assertion in
the generator itself: if a future change to the vocabulary or the search
budget ever makes the fallback path reachable again in a way that isn't
provably unique-forcing, generation throws immediately instead of quietly
shipping an ambiguous item.
