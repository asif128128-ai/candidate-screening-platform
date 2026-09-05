#!/usr/bin/env bash
# Spins up a local Postgres 16 (via Homebrew) standing in for a Supabase
# project, for environments without Docker/the Supabase CLI available
# (this dev machine has neither). Creates the anon/authenticated/
# service_role roles (cluster-wide, so handled here) and applies
# supabase/test-stubs.sql (per-database stand-ins for auth/storage schemas
# etc. — shared with .github/workflows/ci.yml's Postgres service so both
# environments stub the same things the same way) — these stubs are NOT
# part of the real schema, they only exist so `supabase/migrations/*.sql`
# can be smoke-tested here.
#
# Usage: ./scripts/local-pg-setup.sh [dbname]
# Then:  psql -d <dbname> ...   or   DATABASE_URL=postgres://localhost/<dbname>
#
# Real correctness against actual Supabase Auth/Storage/RLS-as-seen-by-PostgREST
# still must be verified against a real Supabase project before launch
# (see IMPLEMENTATION_NOTES.md) — this script only catches SQL syntax/logic
# errors in our own migrations early, without needing Docker.

set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

DB="${1:-screening_test}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! pg_ctl -D /opt/homebrew/var/postgresql@16 status >/dev/null 2>&1; then
  pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/pg16.log start
  sleep 2
fi

psql -d postgres -v ON_ERROR_STOP=1 <<'EOF'
do $$
begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
EOF

dropdb --if-exists "$DB"
createdb "$DB"

psql -d "$DB" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/supabase/test-stubs.sql"

for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  echo "applying $f"
  psql -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "OK: $DB is ready. Connect with: psql -d $DB"
echo "Or: DATABASE_URL=postgres://\$(whoami)@localhost:5432/$DB"
