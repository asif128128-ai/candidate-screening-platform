// CANDIDATE_FLOW.md §2.2: duplicate-signal decisions. Pure decision logic —
// the DB lookups (same email + job, same email + other job, same phone +
// different candidate) live in src/db/queries/candidates.ts; this module
// only decides what to do given what was found, so the policy is
// unit-testable without a database (TEST_STRATEGY.md §2 "Duplicate signals").

export interface SameJobApplicationSignal {
  applicationId: string;
  /** true once the assessment session has completed for this application. */
  completed: boolean;
  /** application.created_at + job.response_window_days, only needed when completed. */
  responseByDate: Date;
}

export type DuplicateOutcome =
  | { kind: "redirect_to_resume"; prefillEmail: string }
  | { kind: "already_completed"; responseByDate: Date }
  | { kind: "create_new"; duplicatePhoneOfCandidateId: string | null };

/**
 * Decides what happens for a step-1 submission given what the DB lookups
 * found. `sameJobApplication` is non-null only when the *same normalized
 * email* already has an application for the *same job* being applied to.
 * `phoneMatchCandidateId` is the id of a *different* candidate row whose
 * phone number matches (never blocks — just flags for the admin).
 */
export function decideDuplicateOutcome(
  email: string,
  sameJobApplication: SameJobApplicationSignal | null,
  phoneMatchCandidateId: string | null,
): DuplicateOutcome {
  if (sameJobApplication) {
    if (sameJobApplication.completed) {
      return { kind: "already_completed", responseByDate: sameJobApplication.responseByDate };
    }
    return { kind: "redirect_to_resume", prefillEmail: email };
  }
  return { kind: "create_new", duplicatePhoneOfCandidateId: phoneMatchCandidateId };
}
