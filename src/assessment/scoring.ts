// TODO(assessment-engine engineer): responses -> pillar scores
// (SCORING.md, all sections). Pure function, no I/O, no candidate PII in
// the signature (SCORING.md principles: date of birth/average/institution
// are never inputs — enforced by this type). Must reproduce the worked
// example in SCORING.md §10 exactly, and hold the
// `skip_dominates_blind_guess` invariant (§3.6) over 10,000 random
// behaviors.

export interface ScoreSessionInput {
  items: unknown[];
  responses: unknown[];
  events: unknown[];
  blueprint: unknown;
}

export interface ScoreSessionResult {
  scoreReasoning: number;
  scoreIndependence: number;
  scoreTech: number;
  scoreSpeed: number;
  scoreOverall: number;
  confidence: number;
  breakdown: unknown;
}

export function scoreSession(_input: ScoreSessionInput): ScoreSessionResult {
  throw new Error("scoreSession() not implemented — see SCORING.md");
}
