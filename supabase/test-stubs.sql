-- Minimal stand-ins for objects Supabase's platform normally pre-creates
-- in every project, which supabase/migrations/*.sql assumes already exist
-- (anon/authenticated/service_role roles are created separately, since
-- those are cluster-wide, not per-database — see the two callers of this
-- file). NOT part of the real schema: this exists only so our own
-- migrations can be smoke-tested against a plain local/CI Postgres
-- instance, without Docker or the Supabase CLI.
--
-- Used by:
--   - scripts/local-pg-setup.sh (local dev machine, no Docker available)
--   - .github/workflows/ci.yml (CI's postgres: service container)
--
-- Real correctness against actual Supabase Auth/Storage/PostgREST-enforced
-- RLS still must be verified against a real Supabase project before launch
-- (see IMPLEMENTATION_NOTES.md "Local database testing").

create schema if not exists auth;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
