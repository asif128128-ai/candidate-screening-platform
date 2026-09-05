-- Trivial pgTAP smoke test so `supabase test db` has something passing out
-- of the box. Real RLS/trigger/cascade tests per TEST_STRATEGY.md §7 are
-- for the engineers who build the flows those tables serve — this only
-- proves the harness and migration 0001 are wired up correctly.
begin;
select plan(2);

select has_table('public', 'applications', 'applications table exists');
select has_table('public', 'assessment_results', 'assessment_results table exists');

select * from finish();
rollback;
