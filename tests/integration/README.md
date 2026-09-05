# Integration tests

TEST_STRATEGY.md §1, §4: Vitest against a real Postgres (`supabase start`,
Docker) — server actions and route handlers, transactions, triggers,
storage. Each test runs in a transaction rolled back at the end (via
`postgres.js` `sql.begin`), or with a truncate between files for
storage-involving tests.

Nothing lives here yet — it's blocked on there being server actions/routes
to test (currently placeholders). See `IMPLEMENTATION_STATE.md`.
