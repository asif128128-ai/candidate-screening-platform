// TODO(assessment-engine engineer): seed -> concrete session items
// (ARCHITECTURE.md §4, ASSESSMENT_DESIGN.md §3-§4). Pure function, no I/O:
// given a blueprint (assessment_configs.blueprint) and a 64-bit seed,
// deterministically picks templates from src/assessment/bank/* and renders
// 27 concrete items (content + answer_key), honoring the invariants in
// ASSESSMENT_DESIGN.md §4.4 (no family repeats, difficulty mix, escalation
// constraints, scenario cohort balance, conventions_stated text present).
// Must be exhaustively unit-tested (bank:audit script, 20,000 sessions)
// before any UI is built on top of it (DESIGN_SUMMARY.md §8 milestone 2).

export interface GeneratedItem {
  position: number;
  blockKey: string;
  pillar: "reasoning" | "independence" | "tech" | "speed";
  templateId: string;
  templateVersion: number;
  variantSeed: bigint;
  kind:
    | "single_choice"
    | "multi_choice"
    | "numeric"
    | "short_text"
    | "ordering"
    | "investigation";
  difficulty: 1 | 2 | 3;
  timeLimitS: number;
  content: unknown;
  answerKey: unknown;
}

export interface Blueprint {
  version: number;
  blocks: Array<{
    key: string;
    pillar: "reasoning" | "independence" | "tech" | "speed";
    count: number;
    time_limit_s: number;
    pool: string;
  }>;
  weights: Record<string, number>;
  session_wall_clock_min: number;
}

export function generateSession(_blueprint: Blueprint, _seed: bigint): GeneratedItem[] {
  throw new Error("generateSession() not implemented — see ASSESSMENT_DESIGN.md §3-§4");
}
