#!/usr/bin/env bash
# Spins up a local Postgres 16 (via Homebrew) standing in for a Supabase
# project, for environments without Docker/the Supabase CLI available
# (this dev machine has neither). Creates minimal stubs for the
# Supabase-managed objects our migrations assume already exist
# (anon/authenticated/service_role roles, auth/storage schemas,
# storage.buckets table) — these stubs are NOT part of the real schema,
# they only exist so `supabase/migrations/*.sql` can be smoke-tested here.
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

psql -d "$DB" -v ON_ERROR_STOP=1 <<'EOF'
create schema auth;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
EOF

for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  echo "applying $f"
  psql -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "OK: $DB is ready. Connect with: psql -d $DB"
echo "Or: DATABASE_URL=postgres://\$(whoami)@localhost:5432/$DB"
