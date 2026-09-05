// TODO(assessment-engine engineer): CI gate — generate 20,000 sessions via
// src/assessment/generator.ts and fail the build if any invariant in
// ASSESSMENT_DESIGN.md §4.4 is violated (family repeats, difficulty mix,
// escalation constraints, scenario cohort balance, conventions_stated
// text present, template.score(key.answer) = 1 for every generated item,
// etc.). Prints per-family variant estimates and collision probability for
// 500 sessions (TEST_STRATEGY.md §6). Blocked on generateSession() being
// implemented — currently a placeholder that throws.
console.error(
  "[bank:audit] not implemented — depends on src/assessment/generator.ts (see ASSESSMENT_DESIGN.md §4.4, TEST_STRATEGY.md §6).",
);
process.exit(1);
