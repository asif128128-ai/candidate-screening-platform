-- 0008_duplicate_phone_of_fk_fix.sql
-- Red-team finding #1 (CRITICAL): applications.duplicate_phone_of had no ON
-- DELETE action, defaulting to NO ACTION/RESTRICT. That meant
-- delete_candidate() (0001_init.sql §7.2) raised a foreign-key violation
-- whenever the candidate being deleted was referenced as *someone else's*
-- duplicate-phone flag (applications.duplicate_phone_of), since deleting
-- `candidates` cascades to that candidate's own `applications` row but does
-- nothing about *other* applications' `duplicate_phone_of` column pointing
-- at the now-deleted candidates.id.
--
-- This poisoned prune_retention() -> run_maintenance_sweep() -> /api/health
-- (the sweep's own lock-claim UPDATE commits fine, but the same transaction
-- then aborts on this FK violation later in prune_retention(), rolling back
-- the whole transaction *including* the lock claim -- so run_maintenance_sweep
-- never durably advances `maintenance.last_sweep` past this point and retries
-- forever), and separately broke the admin bulk-archive-and-delete feature
-- (any batch containing such a candidate rolled back entirely inside that
-- one `withCurrentAdmin` transaction).
--
-- Fix: ON DELETE SET NULL -- when the referenced candidate is deleted, the
-- referencing application's duplicate_phone_of simply clears (it was only
-- ever an informational flag for admins, "this candidate's phone number
-- matches another one already in the system" -- CANDIDATE_FLOW.md §2.2; it
-- has no cascading behavioral meaning that requires the pointer to survive).

alter table applications
  drop constraint applications_duplicate_phone_of_fkey,
  add constraint applications_duplicate_phone_of_fkey
    foreign key (duplicate_phone_of) references candidates(id) on delete set null;
