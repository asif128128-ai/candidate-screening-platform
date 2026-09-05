# Integration tests

TEST_STRATEGY.md §1, §4: Vitest against a real Postgres (`supabase start`,
Docker) — server actions and route handlers, transactions, triggers,
storage. Each test runs in a transaction rolled back at the end (via
`postgres.js` `sql.begin`), or with a truncate between files for
storage-involving tests.

`admin-rls-security.test.ts` (added by the admin-ui engineer pass) is the
first test here: it exercises the RLS boundary on `admin_application_rows`
directly against a real Postgres — the local stand-in from
`./scripts/local-pg-setup.sh` in this environment (no Docker/Supabase CLI
available; see `IMPLEMENTATION_NOTES.md`), a real Supabase Postgres in CI
once that's wired up. It self-skips (`describe.skipIf`) when
`DATABASE_URL` isn't set, so it doesn't fail CI before that DB is available
there — see the file's own comment for exactly what condition it's checking
and why the skip is safe.

Candidate-flow/assessment-engine server actions and routes still have
nothing here — that part is still blocked on those pieces existing (see
`IMPLEMENTATION_STATE.md`).
