// pnpm bank:audit — CI gate (ASSESSMENT_DESIGN.md §4.4, TEST_STRATEGY.md
// §6). Generates many sessions via src/assessment/generator.ts and fails
// the build if any bank invariant is violated. No I/O beyond stdout —
// everything under test is the pure src/assessment/* modules.

import { generateSession, type Blueprint, type GenerateSessionOptions } from "../src/assessment/generator";
import {
  scoreItem,
  scoreSession,
  type CandidateAnswer,
  type ScoringEvent,
  type ScoringItem,
  type ScoringResponse,
} from "../src/assessment/scoring";
import type { AnswerKey, GeneratedItem, InvestigationAnswerKey, InvestigationContent } from "../src/assessment/types";
import { ALL_CHOICE_TEMPLATES, INVESTIGATION_SCENARIOS } from "../src/assessment/bank";

const SESSION_COUNT = Number(process.env.BANK_AUDIT_SESSIONS ?? 20000);
const COLLISION_SAMPLE = 500;

const BLUEPRINT: Blueprint = {
  version: 3,
  blocks: [
    { key: "speed", pillar: "speed", count: 10, time_limit_s: 15, pool: "speed.*" },
    { key: "knowledge", pillar: "tech", count: 10, time_limit_s: 15, pool: "knowledge.*" },
    { key: "reasoning", pillar: "reasoning", count: 6, time_limit_s: 30, pool: "reasoning.*" },
    { key: "tech", pillar: "tech", count: 8, time_limit_s: 30, pool: "tech.*" },
    { key: "investigate", pillar: "independence", count: 3, time_limit_s: 150, pool: "investigate.*" },
  ],
  weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 },
  session_wall_clock_min: 75,
};

/** Blueprint v2 total (0013_blueprint_v2_fast_items.sql). */
const EXPECTED_ITEM_COUNT = BLUEPRINT.blocks.reduce((sum, b) => sum + b.count, 0);

const NON_INVESTIGATION_CONTENT_BUDGET = 1600;
const ARTIFACT_BODY_BUDGET = 900;

const failures: string[] = [];
function fail(msg: string): void {
  failures.push(msg);
}

function correctAnswerFor(item: GeneratedItem): CandidateAnswer {
  const key = item.answerKey as AnswerKey;
  switch (key.kind) {
    case "single_choice":
      return { selectedIndex: key.correctIndex };
    case "multi_choice":
      return { selectedIndexes: key.correctIndexes };
    case "numeric":
      return { value: key.correctValue };
    case "short_text":
      return { text: key.correctText };
    case "ordering":
      return { order: key.correctOrder };
    case "investigation":
      return { q1: key.q1CorrectIndex, q2: key.q2CorrectIndex, q3: key.q3CorrectText };
  }
}

function optionsOf(item: GeneratedItem): string[] | null {
  const c = item.content as unknown as Record<string, unknown>;
  if (Array.isArray(c.options)) return c.options as string[];
  return null;
}

function artifactsOf(item: GeneratedItem): Array<{ key: string; label: string; body: string; decoy?: boolean }> {
  const c = item.content as unknown as Record<string, unknown>;
  if (Array.isArray(c.tabs)) return c.tabs as Array<{ key: string; label: string; body: string; decoy?: boolean }>;
  if (Array.isArray(c.artifacts)) return c.artifacts as Array<{ key: string; label: string; body: string; decoy?: boolean }>;
  return [];
}

function forEachStringLeaf(value: unknown, visit: (s: string) => void): void {
  if (typeof value === "string") {
    visit(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) forEachStringLeaf(entry, visit);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) forEachStringLeaf(v, visit);
  }
}

/**
 * Reading-load character count for the layout budget (ASSESSMENT_DESIGN.md
 * §4.4). SVG markup (reasoning.grid_pattern's option cells) is excluded —
 * it is a rendered graphical asset, not text the candidate reads, and its
 * raw source length is a poor proxy for on-screen size.
 */
function renderedCharCount(item: GeneratedItem): number {
  let total = 0;
  forEachStringLeaf(item.content, (s) => {
    if (!s.startsWith("<svg")) total += s.length;
  });
  return total;
}

/** Every raw string value in the content tree, concatenated for verbatim substring checks (not JSON-escaped, unlike JSON.stringify). */
function collectRawStrings(item: GeneratedItem): string {
  const parts: string[] = [];
  forEachStringLeaf(item.content, (s) => parts.push(s));
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// "Longest-option bot" simulation (Finding A regression guard, cont'd): a
// bot that reads nothing and always answers with the longest-looking
// option — skipping any item where there's no unique longest text to pick
// (numeric/ordering/short_text, or a tie), and never opening an
// investigation artifact — run through the REAL scoreSession, must land in
// a low/chance-level band, not the "high/exceptional" the original bug let
// it reach on ~half the investigation scenario pool.
// ---------------------------------------------------------------------------
function toScoringItem(item: GeneratedItem): ScoringItem {
  const scoringItem: ScoringItem = {
    position: item.position,
    blockKey: item.blockKey,
    pillar: item.pillar,
    kind: item.kind,
    difficulty: item.difficulty,
    timeLimitS: item.timeLimitS,
    answerKey: item.answerKey,
    templateId: item.templateId,
  };
  if (item.kind === "investigation") {
    scoringItem.artifactKeys = (item.content as InvestigationContent).tabs.map((t) => t.key);
  }
  return scoringItem;
}

function skippedResponse(position: number): ScoringResponse {
  return { position, status: "skipped", answer: null, responseMs: null, firstInteractionMs: null, answerChanges: 0 };
}

/** The bot's answer for one item: never opens artifacts, so `events` is always []. */
function longestOptionBotResponse(item: GeneratedItem): ScoringResponse {
  const limitMs = item.timeLimitS * 1000;
  const responseMs = Math.round(limitMs * 0.6); // an unhurried, unremarkable pace — not trying to also game timing
  const firstInteractionMs = Math.round(limitMs * 0.1);

  switch (item.kind) {
    case "single_choice": {
      const options = optionsOf(item) ?? [];
      const idx = uniqueLongestIndex(options);
      if (idx === null) return skippedResponse(item.position);
      return {
        position: item.position,
        status: "answered",
        answer: { selectedIndex: idx },
        responseMs,
        firstInteractionMs,
        answerChanges: 0,
      };
    }
    case "investigation": {
      const content = item.content as InvestigationContent;
      const q1Idx = uniqueLongestIndex(content.q1.options);
      const q2Idx = uniqueLongestIndex(content.q2.options);
      if (q1Idx === null && q2Idx === null) return skippedResponse(item.position);
      return {
        position: item.position,
        status: "answered",
        // The bot never reads an artifact, so it has no candidate value for
        // q3's extracted-fact question — left blank, same as a real
        // candidate who guesses q1/q2 but skips q3.
        answer: { q1: q1Idx, q2: q2Idx, q3: null },
        responseMs,
        firstInteractionMs,
        answerChanges: 0,
      };
    }
    // numeric / short_text / ordering / multi_choice (unused in the bank
    // today): no text "options" to compare lengths of — per the brief,
    // skipped rather than guessed at.
    default:
      return skippedResponse(item.position);
  }
}

// ---------------------------------------------------------------------------
// Stats accumulators
// ---------------------------------------------------------------------------
const templateUsage = new Map<string, number>();
const scenarioUsage = new Map<string, number>();
const difficultyCountsByBlock = new Map<string, Map<number, number>>();
let escalationCorrectSessions = 0;
let noEvidenceDistractorSessions = 0;

// ---------------------------------------------------------------------------
// Finding A regression guard (IMPLEMENTATION_STATE.md, red-team pass): the
// correct option must not be predictable from length alone anywhere in the
// bank. `longestOptionStats` tracks, per template (and, for investigation
// scenarios, separately per q1/q2), how often the UNIQUE longest option is
// the correct one. A bot that always picks the longest option should do no
// better than roughly chance on this — the 35% ceiling below is well above
// naive chance (25-33% for the bank's typical 3-5 option items) so normal
// random variance never trips it, but far below the ~90-100% the original
// bug produced.
// ---------------------------------------------------------------------------
const LONGEST_OPTION_MAX_RATE = 0.35;
const longestOptionStats = new Map<string, { total: number; longestCorrect: number }>();

function uniqueLongestIndex(options: readonly string[]): number | null {
  if (options.length === 0) return null;
  const lengths = options.map((o) => o.length);
  const maxLen = Math.max(...lengths);
  const longestIdxs: number[] = [];
  lengths.forEach((l, i) => {
    if (l === maxLen) longestIdxs.push(i);
  });
  return longestIdxs.length === 1 ? (longestIdxs[0] as number) : null;
}

function trackLongestOption(key: string, options: readonly string[], correctIndex: number): void {
  const stat = longestOptionStats.get(key) ?? { total: 0, longestCorrect: 0 };
  stat.total++;
  const idx = uniqueLongestIndex(options);
  if (idx !== null && idx === correctIndex) stat.longestCorrect++;
  longestOptionStats.set(key, stat);
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

console.log(`[bank:audit] generating ${SESSION_COUNT} sessions...`);
const startedAt = Date.now();

const scenarioUsageCounts: Record<string, number> = {};

for (let i = 0; i < SESSION_COUNT; i++) {
  const seed = BigInt(i) * 6364136223846793005n + 1442695040888963407n;
  const options: GenerateSessionOptions = { scenarioUsageCounts };
  let items: GeneratedItem[];
  try {
    items = generateSession(BLUEPRINT, seed, options);
  } catch (err) {
    fail(`session ${i} (seed ${seed}) threw: ${String(err)}`);
    continue;
  }

  if (items.length !== EXPECTED_ITEM_COUNT) {
    fail(`session ${i}: expected ${EXPECTED_ITEM_COUNT} items, got ${items.length}`);
    continue;
  }

  const positions = items.map((it) => it.position);
  const expectedPositions = Array.from({ length: EXPECTED_ITEM_COUNT }, (_, k) => k + 1);
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    fail(`session ${i}: item positions not sequential 1..${EXPECTED_ITEM_COUNT}: ${positions.join(",")}`);
  }

  const byBlock = new Map<string, GeneratedItem[]>();
  for (const item of items) {
    const list = byBlock.get(item.blockKey) ?? [];
    list.push(item);
    byBlock.set(item.blockKey, list);
    bump(templateUsage, item.templateId);
    if (item.blockKey === "investigate") {
      bump(scenarioUsage, item.templateId);
      scenarioUsageCounts[item.templateId] = (scenarioUsageCounts[item.templateId] ?? 0) + 1;
    }
    const diffMap = difficultyCountsByBlock.get(item.blockKey) ?? new Map<number, number>();
    diffMap.set(item.difficulty, (diffMap.get(item.difficulty) ?? 0) + 1);
    difficultyCountsByBlock.set(item.blockKey, diffMap);
  }

  // No family repeats within a session, per block.
  for (const [blockKey, blockItems] of byBlock) {
    const ids = blockItems.map((it) => it.templateId);
    if (new Set(ids).size !== ids.length) {
      fail(`session ${i}, block ${blockKey}: duplicate template within one session: ${ids.join(",")}`);
    }
  }

  for (const item of items) {
    // Correctness roundtrip: the declared correct answer scores exactly 1.
    const correct = correctAnswerFor(item);
    const result = scoreItem(item.kind, correct, item.answerKey);
    if (result.sI !== 1) {
      fail(`session ${i}, item ${item.templateId}@${item.position}: correct answer scored ${result.sI}, expected 1`);
    }

    // Every distractor option scores 0 (single/multi-choice kinds only —
    // ordering/numeric/short_text don't have an "options" list to enumerate).
    const options = optionsOf(item);
    if (options) {
      if (new Set(options).size !== options.length) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: duplicate option text: ${JSON.stringify(options)}`);
      }
      if (item.kind === "single_choice") {
        const key = item.answerKey as Extract<AnswerKey, { kind: "single_choice" }>;
        for (let idx = 0; idx < options.length; idx++) {
          if (idx === key.correctIndex) continue;
          const r = scoreItem("single_choice", { selectedIndex: idx }, item.answerKey);
          if (r.sI !== 0) {
            fail(`session ${i}, item ${item.templateId}@${item.position}: distractor option ${idx} scored ${r.sI}, expected 0`);
          }
        }
        trackLongestOption(item.templateId, options, key.correctIndex);
      }
    }

    if (item.kind === "investigation") {
      const key = item.answerKey as InvestigationAnswerKey;
      const content = item.content as { tabs: Array<{ key: string; body: string }>; q1: { options: string[] }; q2: { options: string[] } };
      const tabKeys = new Set(content.tabs.map((t) => t.key));
      if (!tabKeys.has(key.decisiveArtifactKeyQ1)) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: decisiveArtifactKeyQ1 "${key.decisiveArtifactKeyQ1}" not among tabs`);
      }
      if (!tabKeys.has(key.decisiveArtifactKeyQ3)) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: decisiveArtifactKeyQ3 "${key.decisiveArtifactKeyQ3}" not among tabs`);
      }
      // The q3 fact must appear in its decisive artifact...
      const q3Tab = content.tabs.find((t) => t.key === key.decisiveArtifactKeyQ3);
      if (q3Tab && !q3Tab.body.includes(key.q3CorrectText)) {
        fail(
          `session ${i}, item ${item.templateId}@${item.position}: q3 fact "${key.q3CorrectText}" not found verbatim in its decisive artifact "${key.decisiveArtifactKeyQ3}"`,
        );
      }
      // ...and no OTHER artifact should also contain it (uniqueness of the extracted fact).
      for (const tab of content.tabs) {
        if (tab.key === key.decisiveArtifactKeyQ3) continue;
        if (key.q3CorrectText.length >= 3 && tab.body.includes(key.q3CorrectText)) {
          fail(
            `session ${i}, item ${item.templateId}@${item.position}: q3 fact "${key.q3CorrectText}" also appears in non-decisive artifact "${tab.key}" (leaks the answer)`,
          );
        }
      }
      if (new Set(content.q1.options).size !== content.q1.options.length) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: duplicate q1 option text`);
      }
      if (new Set(content.q2.options).size !== content.q2.options.length) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: duplicate q2 option text`);
      }
      trackLongestOption(`${item.templateId}::q1`, content.q1.options, key.q1CorrectIndex);
      trackLongestOption(`${item.templateId}::q2`, content.q2.options, key.q2CorrectIndex);
    }

    // conventions_stated verbatim check (ASSESSMENT_DESIGN.md §4.4).
    if (item.conventionsStated !== "n/a") {
      const rendered = collectRawStrings(item);
      if (!rendered.includes(item.conventionsStated)) {
        fail(
          `session ${i}, item ${item.templateId}@${item.position}: declared conventions_stated text does not appear verbatim in rendered content`,
        );
      }
    }

    // Layout budget.
    if (item.kind !== "investigation") {
      const chars = renderedCharCount(item);
      if (chars > NON_INVESTIGATION_CONTENT_BUDGET) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: rendered content ${chars} chars exceeds budget ${NON_INVESTIGATION_CONTENT_BUDGET}`);
      }
    } else {
      for (const artifact of artifactsOf(item)) {
        if (artifact.body.length > ARTIFACT_BODY_BUDGET) {
          fail(
            `session ${i}, item ${item.templateId}@${item.position}: artifact "${artifact.key}" body ${artifact.body.length} chars exceeds budget ${ARTIFACT_BODY_BUDGET}`,
          );
        }
      }
      const hasDecoy = artifactsOf(item).some((a) => a.decoy);
      if (!hasDecoy) {
        fail(`session ${i}, item ${item.templateId}@${item.position}: no decoy artifact declared`);
      }
    }
  }

  // Session-level escalation invariants (ASSESSMENT_DESIGN.md §3.3, DECISIONS_LOG.md #6).
  const invItems = items.filter((it) => it.blockKey === "investigate");
  const sessionHasEscalationCorrect = invItems.some((it) => (it.answerKey as InvestigationAnswerKey).q2IsEscalation);
  const sessionHasNoEvidenceDistractor = invItems.some(
    (it) => (it.answerKey as InvestigationAnswerKey).q2HasNoEvidenceEscalationDistractor,
  );
  if (sessionHasEscalationCorrect) escalationCorrectSessions++;
  if (sessionHasNoEvidenceDistractor) noEvidenceDistractorSessions++;
  if (!sessionHasEscalationCorrect) {
    fail(`session ${i}: no scene has escalation-with-proposal as the correct q2 answer`);
  }
  if (!sessionHasNoEvidenceDistractor) {
    fail(`session ${i}: no scene has the no-evidence-escalation distractor present`);
  }
}

const elapsedMs = Date.now() - startedAt;

// ---------------------------------------------------------------------------
// Collision-probability estimate for COLLISION_SAMPLE sessions (TEST_STRATEGY.md §6).
// ---------------------------------------------------------------------------
const seenFamilySets = new Map<string, number>();
for (let i = 0; i < COLLISION_SAMPLE; i++) {
  const seed = BigInt(i) * 2654435761n + 998244353n;
  const items = generateSession(BLUEPRINT, seed, {});
  const key = items
    .map((it) => it.templateId)
    .sort()
    .join("|");
  seenFamilySets.set(key, (seenFamilySets.get(key) ?? 0) + 1);
}
const duplicateFamilySets = [...seenFamilySets.values()].filter((c) => c > 1).length;

// ---------------------------------------------------------------------------
// Longest-option bot: run it through the real scoreSession over SESSION_COUNT
// fresh sessions (a separate seed stream from both loops above).
// ---------------------------------------------------------------------------
const BOT_MAX_MEAN_SCORE = 50; // SCORING.md §4 "low" band ceiling — the bot must not clear it
const botIndependenceScores: number[] = [];
const botTechScores: number[] = [];
for (let i = 0; i < SESSION_COUNT; i++) {
  const seed = BigInt(i) * 3202034522019661n + 1013904223n;
  const items = generateSession(BLUEPRINT, seed, {});
  const scoringItems = items.map(toScoringItem);
  const responses = items.map(longestOptionBotResponse);
  const events: ScoringEvent[] = []; // the bot opens nothing, ever
  const result = scoreSession({ items: scoringItems, responses, events, blueprint: { weights: BLUEPRINT.weights } });
  botIndependenceScores.push(result.scoreIndependence);
  botTechScores.push(result.scoreTech);
}
const mean = (xs: number[]): number => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const botMeanIndependence = mean(botIndependenceScores);
const botMeanTech = mean(botTechScores);
if (botMeanIndependence >= BOT_MAX_MEAN_SCORE) {
  fail(
    `longest-option bot: mean Independence ${botMeanIndependence.toFixed(1)} is not low/chance-level (>= ${BOT_MAX_MEAN_SCORE})`,
  );
}
if (botMeanTech >= BOT_MAX_MEAN_SCORE) {
  fail(`longest-option bot: mean Tech ${botMeanTech.toFixed(1)} is not low/chance-level (>= ${BOT_MAX_MEAN_SCORE})`);
}

// ---------------------------------------------------------------------------
// Print report
// ---------------------------------------------------------------------------
console.log(`[bank:audit] generated ${SESSION_COUNT} sessions in ${elapsedMs}ms (${(elapsedMs / SESSION_COUNT).toFixed(2)}ms/session)`);
console.log(`[bank:audit] bank size: ${ALL_CHOICE_TEMPLATES.length} choice templates + ${INVESTIGATION_SCENARIOS.length} investigation scenarios`);
console.log(
  `[bank:audit] escalation-correct scene present in ${escalationCorrectSessions}/${SESSION_COUNT} sessions; no-evidence-escalation distractor present in ${noEvidenceDistractorSessions}/${SESSION_COUNT}`,
);
console.log(`[bank:audit] family-set collisions in ${COLLISION_SAMPLE}-session sample: ${duplicateFamilySets}`);

console.log(`[bank:audit] per-template usage (of ${SESSION_COUNT} sessions):`);
for (const t of ALL_CHOICE_TEMPLATES) {
  console.log(`  ${t.id}: ${templateUsage.get(t.id) ?? 0}`);
}

console.log(`[bank:audit] per-scenario usage (of ${SESSION_COUNT * 4} investigation slots):`);
const scenarioCounts = INVESTIGATION_SCENARIOS.map((s) => scenarioUsage.get(s.id) ?? 0);
const avgScenarioUsage = scenarioCounts.reduce((a, b) => a + b, 0) / scenarioCounts.length;
for (const s of INVESTIGATION_SCENARIOS) {
  const count = scenarioUsage.get(s.id) ?? 0;
  const deviationPct = avgScenarioUsage > 0 ? (((count - avgScenarioUsage) / avgScenarioUsage) * 100).toFixed(1) : "n/a";
  console.log(`  ${s.id}: ${count} (${deviationPct}% vs average)`);
}
const maxDeviation = Math.max(...scenarioCounts.map((c) => Math.abs(c - avgScenarioUsage) / avgScenarioUsage));
if (maxDeviation > 0.1) {
  fail(`per-scenario usage deviates from average by more than ±10% (max ${(maxDeviation * 100).toFixed(1)}%)`);
}

console.log(`[bank:audit] difficulty mix per block:`);
for (const [blockKey, diffMap] of difficultyCountsByBlock) {
  const entries = [...diffMap.entries()].sort((a, b) => a[0] - b[0]);
  console.log(`  ${blockKey}: ${entries.map(([d, c]) => `d${d}=${c}`).join(" ")}`);
}

console.log(
  `[bank:audit] longest-option-is-correct rate per template/scenario (fails above ${(LONGEST_OPTION_MAX_RATE * 100).toFixed(0)}%):`,
);
for (const [key, stat] of [...longestOptionStats.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const rate = stat.total > 0 ? stat.longestCorrect / stat.total : 0;
  const flag = rate > LONGEST_OPTION_MAX_RATE ? "  <-- FAIL" : "";
  console.log(`  ${key}: ${(rate * 100).toFixed(1)}% (n=${stat.total})${flag}`);
  if (rate > LONGEST_OPTION_MAX_RATE) {
    fail(
      `longest-option gameability: "${key}" has a unique-longest-option-is-correct rate of ${(rate * 100).toFixed(1)}% (> ${(LONGEST_OPTION_MAX_RATE * 100).toFixed(0)}% allowed) over ${stat.total} instances`,
    );
  }
}

console.log(
  `[bank:audit] longest-option bot (picks the longest option, skips numeric/ordering/short_text and ties, opens no artifacts) over ${SESSION_COUNT} sessions:`,
);
console.log(`  mean Independence = ${botMeanIndependence.toFixed(1)} (must be < ${BOT_MAX_MEAN_SCORE})`);
console.log(`  mean Tech         = ${botMeanTech.toFixed(1)} (must be < ${BOT_MAX_MEAN_SCORE})`);

if (failures.length > 0) {
  console.error(`\n[bank:audit] FAILED with ${failures.length} violation(s):`);
  for (const f of failures.slice(0, 100)) console.error(`  - ${f}`);
  if (failures.length > 100) console.error(`  ... and ${failures.length - 100} more`);
  process.exit(1);
}

console.log("\n[bank:audit] PASSED — all invariants hold.");
