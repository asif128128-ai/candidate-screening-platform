// TODO(assessment-engine engineer): events -> integrity risk level + reasons
// (ANTI_CHEATING.md §5). Pure function, no I/O, never an input to
// scoreSession(). Must implement the weighted signals (§5.1), excusals
// (§5.2), and hard floors (§5.3) exactly — including the "a fully scripted
// run lands at סיכון גבוה regardless of plausible timing" guarantee.

export type IntegrityRisk = "low" | "medium" | "high";

export interface IntegrityReason {
  code: string;
  he: string;
  weight: number;
  evidence: unknown;
}

export interface ComputeIntegrityResult {
  score: number; // 0..100, higher = more concerning
  risk: IntegrityRisk;
  reasons: IntegrityReason[];
}

export function computeIntegrity(
  _items: unknown[],
  _responses: unknown[],
  _events: unknown[],
): ComputeIntegrityResult {
  throw new Error("computeIntegrity() not implemented — see ANTI_CHEATING.md §5");
}
