// generator.ts — seed -> concrete session items (ARCHITECTURE.md §4,
// ASSESSMENT_DESIGN.md §3-§4). Pure function, no I/O: given a blueprint
// (assessment_configs.blueprint) and a 64-bit seed, deterministically picks
// templates from src/assessment/bank/* and renders items, honoring the
// invariants in ASSESSMENT_DESIGN.md §4.4 (no family repeats, difficulty
// mix, escalation constraints, scenario cohort balance, conventions_stated
// text present).
//
// Interface note for the runner-UI engineer: call `generateSession(blueprint,
// seed, options)` once, at session start, and persist the returned
// `GeneratedItem[]` 1:1 into `assessment_items` rows (position, block_key,
// pillar, template_id, template_version, variant_seed, kind, difficulty,
// time_limit_s, content, answer_key). Never call it again for the same
// session — the DB triggers (`items_served_once`) assume content is fixed
// once written. `options.scenarioUsageCounts` is the hook for
// ASSESSMENT_DESIGN.md §3.3.1's cohort balancing: pass a map of
// `investigate.<scenario_id>` -> "how many times this scenario has been
// used in this job's sessions so far" (a cheap indexed COUNT query grouped
// by `assessment_items.template_id`); omit it (or pass `{}`) and the
// generator still works, just without balancing.

import { ALL_CHOICE_TEMPLATES, INVESTIGATION_SCENARIOS } from "./bank";
import { createRng, deriveItemSeed, type Rng } from "./rng";
import type { Cause, Difficulty, GeneratedItem, InvestigationScenario, ItemTemplate, Pillar } from "./types";

export interface BlueprintBlock {
  key: string;
  pillar: Pillar;
  count: number;
  time_limit_s: number;
  pool: string;
}

export interface Blueprint {
  version: number;
  blocks: BlueprintBlock[];
  weights: Record<string, number>;
  session_wall_clock_min: number;
}

export interface GenerateSessionOptions {
  /** ASSESSMENT_DESIGN.md §3.3.1 cohort balancing: `investigate.<scenario_id>` -> prior usage count within the job. */
  scenarioUsageCounts?: Record<string, number>;
}

// Difficulty mixes are fixed per block per ASSESSMENT_DESIGN.md §3.2-§3.4
// worked examples and SCORING.md §10's worked example (which reproduces
// these exact counts): reasoning 2×d1/3×d2/1×d3, tech 2×d1/4×d2/1×d3,
// investigate 1×d1/2×d2/1×d3. Speed has no stated difficulty axis (it is
// scored uniformly per SCORING.md §3.4), so every speed item is difficulty 1.
const DIFFICULTY_MIX: Record<string, Difficulty[]> = {
  speed: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  reasoning: [1, 1, 2, 2, 2, 3],
  tech: [1, 1, 2, 2, 2, 2, 3],
  investigate: [1, 2, 2, 3],
};

function poolForPillar(pillar: Pillar): readonly ItemTemplate[] {
  return ALL_CHOICE_TEMPLATES.filter((t) => t.pillar === pillar);
}

interface Picked {
  template: ItemTemplate;
  difficulty: Difficulty;
}

/** Picks `difficulties.length` distinct templates from `pool`, matching each requested difficulty when possible. */
function pickTemplatesForBlock(rng: Rng, pool: readonly ItemTemplate[], difficulties: readonly Difficulty[]): Picked[] {
  const shuffledDifficulties = rng.shuffle(difficulties);
  const used = new Set<string>();
  const result: Picked[] = [];

  for (const diff of shuffledDifficulties) {
    const matching = pool.filter((t) => !used.has(t.id) && t.difficulties.includes(diff));
    if (matching.length > 0) {
      const chosen = rng.pick(matching);
      used.add(chosen.id);
      result.push({ template: chosen, difficulty: diff });
      continue;
    }
    // Fallback: no unused template declares this exact difficulty. Pick any
    // unused template and clamp to its nearest supported difficulty, so the
    // block always fills even if the bank's difficulty coverage is uneven.
    const fallbackPool = pool.filter((t) => !used.has(t.id));
    if (fallbackPool.length === 0) {
      throw new Error(`generator: template pool exhausted (need ${difficulties.length} distinct families)`);
    }
    const chosen = rng.pick(fallbackPool);
    used.add(chosen.id);
    const nearest = chosen.difficulties.reduce((best, d) =>
      Math.abs(d - diff) < Math.abs(best - diff) ? d : best,
    );
    result.push({ template: chosen, difficulty: nearest });
  }

  return result;
}

function generateChoiceBlock(
  block: BlueprintBlock,
  sessionSeed: bigint,
  startPosition: number,
): GeneratedItem[] {
  const pool = poolForPillar(block.pillar);
  const mix = DIFFICULTY_MIX[block.key] ?? (Array.from({ length: block.count }, () => 1 as Difficulty));
  if (mix.length !== block.count) {
    throw new Error(`generator: difficulty mix for block "${block.key}" has ${mix.length} entries, expected ${block.count}`);
  }

  // A dedicated selection RNG, independent of any single item's RNG, so
  // which families are chosen doesn't depend on how many random draws an
  // individual template.generate() makes.
  const selectionSeed = deriveItemSeed(sessionSeed, `${block.key}.select`, 0);
  const selectionRng = createRng(selectionSeed);
  const picked = pickTemplatesForBlock(selectionRng, pool, mix);
  const ordered = selectionRng.shuffle(picked);

  return ordered.map((p, i) => {
    const position = startPosition + i;
    const itemSeed = deriveItemSeed(sessionSeed, p.template.id, position);
    const itemRng = createRng(itemSeed);
    const generated = p.template.generate(itemRng, p.difficulty);

    const item: GeneratedItem = {
      position,
      blockKey: block.key as GeneratedItem["blockKey"],
      pillar: block.pillar,
      templateId: p.template.id,
      templateVersion: p.template.version,
      variantSeed: itemSeed,
      kind: p.template.kind,
      difficulty: p.difficulty,
      timeLimitS: block.time_limit_s,
      content: generated.content,
      answerKey: generated.answerKey,
      conventionsStated: generated.conventionsStated ?? p.template.conventionsStated,
    };
    if (p.template.fluency) item.fluency = true;
    return item;
  });
}

function generateInvestigationBlock(
  block: BlueprintBlock,
  sessionSeed: bigint,
  startPosition: number,
  options: GenerateSessionOptions,
): GeneratedItem[] {
  const selectionSeed = deriveItemSeed(sessionSeed, `${block.key}.select`, 0);
  const selectionRng = createRng(selectionSeed);

  const usage = options.scenarioUsageCounts ?? {};
  // Cohort balancing (ASSESSMENT_DESIGN.md §3.3.1): shuffle for tie-breaking
  // randomness, then prefer scenarios with lower prior usage.
  const shuffled = selectionRng.shuffle(INVESTIGATION_SCENARIOS);
  const byUsage = shuffled
    .map((s) => ({ s, count: usage[s.id] ?? 0 }))
    .sort((a, b) => a.count - b.count);
  let chosen = byUsage.slice(0, block.count).map((x) => x.s);

  // Session-level escalation invariants (ASSESSMENT_DESIGN.md §3.3,
  // DECISIONS_LOG.md #6): guarantee at least one scene where
  // escalation-with-proposal is correct. That scene's antiPatterns always
  // keep "ask without evidence" as a distractor (helpers.ts
  // pickDistractorKinds), which structurally satisfies the second
  // invariant (>= 1 scene with no-evidence-escalation as a distractor) too.
  const escalationCapable = INVESTIGATION_SCENARIOS.filter((s) => s.escalationCauses.length > 0);
  const alreadyHasEscalation = chosen.some((s) => s.escalationCauses.length > 0);
  let forcedScenarioId: string | null = null;
  if (!alreadyHasEscalation && escalationCapable.length > 0) {
    const notChosen = escalationCapable.filter((s) => !chosen.includes(s));
    const forced = selectionRng.pick(notChosen.length > 0 ? notChosen : escalationCapable);
    // Replace the *most*-used pick (chosen is still usage-sorted ascending
    // here), not the least-used one — this keeps the cohort-balancing hook
    // (§3.3.1) from being undone by the escalation-invariant fixup.
    chosen = [...chosen.slice(0, -1), forced];
    forcedScenarioId = forced.id;
  } else if (alreadyHasEscalation) {
    forcedScenarioId = (chosen.find((s) => s.escalationCauses.length > 0) as InvestigationScenario).id;
  }

  chosen = selectionRng.shuffle(chosen);

  const mix = DIFFICULTY_MIX[block.key] ?? [1, 2, 2, 3];
  const difficulties = selectionRng.shuffle(mix.slice(0, chosen.length));

  return chosen.map((scenario, i) => {
    const position = startPosition + i;
    const isForced = scenario.id === forcedScenarioId && scenario.escalationCauses.length > 0;
    const causeSeed = deriveItemSeed(sessionSeed, `${scenario.id}.cause`, position);
    const causeRng = createRng(causeSeed);
    const cause: Cause = isForced
      ? causeRng.pick(scenario.escalationCauses)
      : causeRng.pick(scenario.causeVariants);

    const difficulty = difficulties[i] as Difficulty;
    const itemSeed = deriveItemSeed(sessionSeed, scenario.id, position);
    const itemRng = createRng(itemSeed);
    const generated = scenario.generate(itemRng, cause, difficulty);

    const item: GeneratedItem = {
      position,
      blockKey: block.key as GeneratedItem["blockKey"],
      pillar: block.pillar,
      templateId: scenario.id,
      templateVersion: scenario.version,
      variantSeed: itemSeed,
      kind: "investigation",
      difficulty,
      timeLimitS: block.time_limit_s,
      content: generated.content,
      answerKey: generated.answerKey,
      // Investigation artifacts are self-contained by construction (the
      // generator builds the world then renders artifacts from it, so every
      // fact needed is always in a tab) — see ASSESSMENT_DESIGN.md §3.3.
      conventionsStated: "n/a",
    };
    return item;
  });
}

export function generateSession(
  blueprint: Blueprint,
  seed: bigint,
  options: GenerateSessionOptions = {},
): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  let position = 1;
  for (const block of blueprint.blocks) {
    const blockItems =
      block.pillar === "independence"
        ? generateInvestigationBlock(block, seed, position, options)
        : generateChoiceBlock(block, seed, position);
    items.push(...blockItems);
    position += block.count;
  }
  return items;
}

export type { GeneratedItem } from "./types";
