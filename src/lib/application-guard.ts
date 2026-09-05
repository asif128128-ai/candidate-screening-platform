import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { checkCandidateCookie } from "./candidate-session";
import {
  getApplicationRoutingState,
  type ApplicationRoutingState,
  type ApplicationStep,
} from "@/db/queries/application-flow";

// CANDIDATE_FLOW.md §1: "Every /apply/* route validates that the cookie's
// application_id matches the URL; mismatch -> 404 ... Steps are strictly
// ordered by server state; hitting a later URL early redirects to the
// correct step; hitting an earlier URL later shows a read-only summary and
// a 'המשך' button." §8: "Cookie missing on /apply/* -> redirect to /resume."

const STEP_ORDER: ApplicationStep[] = ["job", "briefing", "assessment", "done"];

export function stepPath(applicationId: string, step: ApplicationStep): string {
  switch (step) {
    case "job":
      return `/apply/${applicationId}/job`;
    case "briefing":
      return `/apply/${applicationId}/briefing`;
    case "assessment":
      return `/apply/${applicationId}/assessment`;
    case "done":
      return `/apply/${applicationId}/done`;
  }
}

export type StepGuardResult =
  | { kind: "ok"; state: ApplicationRoutingState }
  | { kind: "already_past"; state: ApplicationRoutingState };

/**
 * Common guard for every `/apply/{applicationId}/*` page. Redirects (never
 * returns) on a missing/mismatched cookie, an unknown application, or when
 * the candidate tries to jump ahead of their actual server-side progress.
 * Returns `{ kind: "ok" }` when the requested step matches current progress,
 * or `{ kind: "already_past" }` when the candidate revisits a step they've
 * already completed — the caller renders a read-only summary + "המשך" link
 * in that case instead of the live form (CANDIDATE_FLOW.md §1).
 */
export async function guardApplicationStep(
  applicationId: string,
  requestedStep: ApplicationStep,
): Promise<StepGuardResult> {
  const cookieCheck = await checkCandidateCookie(applicationId);
  if (cookieCheck.kind === "missing") {
    redirect({ href: "/resume", locale: "he" });
  }
  if (cookieCheck.kind === "mismatch") {
    notFound();
  }

  const state = await getApplicationRoutingState(applicationId);
  if (!state) notFound();

  const requestedRank = STEP_ORDER.indexOf(requestedStep);
  const currentRank = STEP_ORDER.indexOf(state.currentStep);

  if (requestedRank > currentRank) {
    // Trying to skip ahead of actual progress -> send back to the real step.
    redirect({ href: stepPath(applicationId, state.currentStep), locale: "he" });
  }

  if (requestedRank < currentRank) {
    // An earlier step visited after already progressing -> read-only summary.
    return { kind: "already_past", state };
  }

  return { kind: "ok", state };
}
