// scoring.ts — responses -> pillar scores (SCORING.md, all sections). Pure
// function, no I/O, no candidate PII in the signature (date of birth,
// average, institution are never inputs — enforced by the types below).
// Integrity is never an input here (ANTI_CHEATING.md §5 / SCORING.md
// principles) — computeIntegrity (integrity.ts) is called separately by
// whoever finalizes a session.
//
// Interface note for the runner-UI / hot-path API engineer:
//   `scoreItem(kind, answer, answerKey)` is the single source of truth for
//   "is this answer correct and what fraction of credit does it get" (§2).
//   Call it once per answer at submit time and store its `sI`/`isCorrect`
//   on the response row (this is what `assessment_responses.is_correct` /
//   `.partial_credit` should hold — for investigation items `isCorrect`
//   reflects sub-question 1 / root-cause correctness specifically, and
//   `partialCredit` holds the full 0.5/0.25/0.25 composite). Then call
//   `scoreSession(...)` once, at session completion, over every served
//   item plus the raw `artifact_open`/`network_retry` events, to get the
//   four pillar scores + overall + confidence + breakdown for
//   `assessment_results`.

import { normalizeText } from "./bank/helpers";
import type {
  AnswerKey,
  BlockKey,
  Difficulty,
  InvestigationAnswerKey,
  ItemKind,
  Pillar,
} from "./types";

// ---------------------------------------------------------------------------
// §2 — item score
// ---------------------------------------------------------------------------

export interface ItemScoreResult {
  /** s_i ∈ [0,1] — SCORING.md §2. */
  sI: number;
  /** Headline correctness shown as ✔/✘ (SCORING.md §8); for investigation this is sub-question 1 (root cause). */
  isCorrect: boolean;
}

export type SingleChoiceAnswer = { selectedIndex: number | null };
export type MultiChoiceAnswer = { selectedIndexes: number[] };
export type NumericAnswer = { value: number | string | null };
export type ShortTextAnswer = { text: string | null };
export type OrderingAnswer = { order: number[] | null };
export type InvestigationAnswer = {
  q1: number | null;
  q2: number | null;
  q3: string | null;
};

export type CandidateAnswer =
  | SingleChoiceAnswer
  | MultiChoiceAnswer
  | NumericAnswer
  | ShortTextAnswer
  | OrderingAnswer
  | InvestigationAnswer;

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { 1: 1.0, 2: 1.3, 3: 1.7 };

function numbersEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function textMatches(candidate: string | null | undefined, correct: string, alternates?: string[]): boolean {
  if (candidate == null) return false;
  const normCandidate = normalizeText(candidate);
  const accepted = [correct, ...(alternates ?? [])].map(normalizeText);
  return accepted.includes(normCandidate);
}

function scoreOrdering(order: number[] | null | undefined, correctOrder: number[]): number {
  if (!order || order.length !== correctOrder.length) return 0;
  const n = correctOrder.length;
  const correctRankOf = new Map<number, number>();
  correctOrder.forEach((itemIdx, rank) => correctRankOf.set(itemIdx, rank));
  if (new Set(order).size !== n) return 0; // not a valid permutation
  const ranks = order.map((itemIdx) => correctRankOf.get(itemIdx));
  if (ranks.some((r) => r === undefined)) return 0;
  const rankSeq = ranks as number[];
  let inversions = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if ((rankSeq[i] as number) > (rankSeq[j] as number)) inversions++;
    }
  }
  const maxInversions = (n * (n - 1)) / 2;
  if (maxInversions === 0) return 1;
  return Math.max(0, 1 - (2 * inversions) / maxInversions);
}

function scoreMultiChoice(selected: number[] | null | undefined, correctIndexes: number[]): number {
  const S = new Set(selected ?? []);
  const C = new Set(correctIndexes);
  if (C.size === 0) return 0;
  let intersect = 0;
  let sMinusC = 0;
  for (const s of S) {
    if (C.has(s)) intersect++;
    else sMinusC++;
  }
  return Math.max(0, intersect - sMinusC) / C.size;
}

/**
 * SCORING.md §2 — the single source of truth for "is this answer correct
 * and what fraction of credit does it get". Pure, no I/O.
 */
export function scoreItem(kind: ItemKind, answer: CandidateAnswer | null | undefined, key: AnswerKey): ItemScoreResult {
  if (answer == null) return { sI: 0, isCorrect: false };

  switch (kind) {
    case "single_choice": {
      const a = answer as SingleChoiceAnswer;
      const k = key as Extract<AnswerKey, { kind: "single_choice" }>;
      const correct = a.selectedIndex !== null && a.selectedIndex === k.correctIndex;
      return { sI: correct ? 1 : 0, isCorrect: correct };
    }
    case "multi_choice": {
      const a = answer as MultiChoiceAnswer;
      const k = key as Extract<AnswerKey, { kind: "multi_choice" }>;
      const sI = scoreMultiChoice(a.selectedIndexes, k.correctIndexes);
      return { sI, isCorrect: sI === 1 };
    }
    case "numeric": {
      const a = answer as NumericAnswer;
      const k = key as Extract<AnswerKey, { kind: "numeric" }>;
      if (a.value === null || a.value === undefined || a.value === "") return { sI: 0, isCorrect: false };
      const num = typeof a.value === "number" ? a.value : Number(normalizeText(String(a.value)).replace(/,/g, ""));
      if (Number.isNaN(num)) return { sI: 0, isCorrect: false };
      const correct = numbersEqual(num, k.correctValue, k.tolerance ?? 0);
      return { sI: correct ? 1 : 0, isCorrect: correct };
    }
    case "short_text": {
      const a = answer as ShortTextAnswer;
      const k = key as Extract<AnswerKey, { kind: "short_text" }>;
      const correct = textMatches(a.text, k.correctText, k.acceptedAlternates);
      return { sI: correct ? 1 : 0, isCorrect: correct };
    }
    case "ordering": {
      const a = answer as OrderingAnswer;
      const k = key as Extract<AnswerKey, { kind: "ordering" }>;
      const sI = scoreOrdering(a.order, k.correctOrder);
      return { sI, isCorrect: sI === 1 };
    }
    case "investigation": {
      const a = answer as InvestigationAnswer;
      const k = key as InvestigationAnswerKey;
      const q1Correct = a.q1 !== null && a.q1 === k.q1CorrectIndex;
      const q2Correct = a.q2 !== null && a.q2 === k.q2CorrectIndex;
      const q3Correct = textMatches(a.q3, k.q3CorrectText, k.q3AcceptedAlternates);
      const sI = 0.5 * (q1Correct ? 1 : 0) + 0.25 * (q2Correct ? 1 : 0) + 0.25 * (q3Correct ? 1 : 0);
      return { sI, isCorrect: q1Correct };
    }
    default: {
      const _exhaustive: never = kind;
      throw new Error(`scoreItem: unhandled kind ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Session-level inputs
// ---------------------------------------------------------------------------

export type ResponseStatus = "answered" | "expired" | "skipped";

export interface ScoringItem {
  position: number;
  blockKey: BlockKey;
  pillar: Pillar;
  kind: ItemKind;
  difficulty: Difficulty;
  timeLimitS: number;
  answerKey: AnswerKey;
  templateId: string;
  outageCreditMs?: number;
  /**
   * Investigation items only: every artifact/tab key in the scene
   * (including the decoy), i.e. `content.tabs.map(t => t.key)`. Needed to
   * detect the "click-through" pattern (SCORING.md §3.3: opened every
   * artifact in < 15s) — without it the click-through cap is skipped
   * rather than guessed at, since scenes have 4 or 5 tabs and guessing
   * wrong in either direction would misgrade `efficiency`.
   */
  artifactKeys?: string[];
}

export interface ScoringResponse {
  position: number;
  status: ResponseStatus;
  answer: CandidateAnswer | null;
  /** Server-measured received_at - served_at, ms. Null only if truly never submitted (pure skip with no client attempt). */
  responseMs: number | null;
  firstInteractionMs: number | null;
  answerChanges: number;
  /**
   * Investigation only: ms since render of the first interaction with any
   * q1/q2/q3 answer control (distinct from opening an artifact tab). Used
   * for the `deliberation` process component (SCORING.md §3.3). See
   * IMPLEMENTATION_STATE.md for why this is a separate field from
   * `firstInteractionMs`.
   */
  firstAnswerSelectMs?: number | null;
}

export interface ScoringEvent {
  position: number; // which item this event belongs to
  kind: "artifact_open" | "network_retry";
  /** ms since the item was rendered (matches ANTI_CHEATING.md §3's `ms_since_render`). */
  atMs: number;
  artifactKey?: string; // artifact_open only
}

export interface ScoringBlueprintBlock {
  key: string;
  pillar: Pillar;
  count: number;
}

export interface ScoringBlueprint {
  weights: Record<string, number>;
}

export interface ScoreSessionInput {
  items: ScoringItem[];
  responses: ScoringResponse[];
  events: ScoringEvent[];
  blueprint: ScoringBlueprint;
}

// ---------------------------------------------------------------------------
// Guess detection — SCORING.md §3.5
// ---------------------------------------------------------------------------

export interface GuessInfo {
  position: number;
  guessed: boolean;
  blind: boolean; // investigation-only "blind guess" (decisive artifact never opened)
}

function computeGuesses(
  items: ScoringItem[],
  responses: Map<number, ScoringResponse>,
  itemScores: Map<number, ItemScoreResult>,
  decisiveArtifactOpened: Map<number, boolean>,
): Map<number, GuessInfo> {
  const result = new Map<number, GuessInfo>();
  for (const item of items) {
    const response = responses.get(item.position);
    const score = itemScores.get(item.position);
    if (!response || !score || response.status === "skipped") {
      result.set(item.position, { position: item.position, guessed: false, blind: false });
      continue;
    }
    const wrong = !score.isCorrect;
    const fastWrong =
      wrong && response.responseMs !== null && response.responseMs < 0.25 * item.timeLimitS * 1000;

    let blind = false;
    if (item.kind === "investigation" && wrong) {
      const opened = decisiveArtifactOpened.get(item.position) ?? false;
      blind = !opened;
    }

    result.set(item.position, { position: item.position, guessed: fastWrong || blind, blind });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Investigation process score — SCORING.md §3.3
// ---------------------------------------------------------------------------

const DWELL_THRESHOLD_MS = 3000;
const CLICK_THROUGH_WINDOW_MS = 15000;

export interface ProcessScoreResult {
  pI: number;
  evidence: number;
  efficiency: number;
  deliberation: number;
  decisiveArtifactOpened: boolean;
}

function computeProcessScore(
  item: ScoringItem,
  response: ScoringResponse | undefined,
  itemEvents: ScoringEvent[],
): ProcessScoreResult {
  const key = item.answerKey as InvestigationAnswerKey;
  const opens = itemEvents
    .filter((e) => e.kind === "artifact_open")
    .slice()
    .sort((a, b) => a.atMs - b.atMs);

  const terminalMs = response?.responseMs ?? (opens.length > 0 ? (opens[opens.length - 1] as ScoringEvent).atMs : 0);

  // dwell[k] = time until the next event, or until submit for the last one.
  const dwellByIndex = opens.map((e, i) => {
    const next = opens[i + 1];
    const end = next ? next.atMs : terminalMs;
    return Math.max(0, end - e.atMs);
  });

  let decisiveOrdinal: number | null = null;
  for (let i = 0; i < opens.length; i++) {
    const e = opens[i] as ScoringEvent;
    if (e.artifactKey === key.decisiveArtifactKeyQ1 && (dwellByIndex[i] as number) >= DWELL_THRESHOLD_MS) {
      decisiveOrdinal = i + 1; // 1-indexed ordinal among ALL opens
      break;
    }
  }

  const evidence = decisiveOrdinal !== null ? 1 : 0;

  let efficiency: number;
  if (decisiveOrdinal === null) efficiency = 0;
  else if (decisiveOrdinal <= 2) efficiency = 1.0;
  else if (decisiveOrdinal <= 3) efficiency = 0.6;
  else efficiency = 0.3;

  // Click-through override: every artifact opened, total span < 15s. Only
  // checkable when the caller told us how many tabs the scene actually had
  // (ScoringItem.artifactKeys) — scenes have 4 or 5 tabs, so a hardcoded
  // count would misgrade one or the other.
  const totalTabCount = item.artifactKeys?.length;
  if (totalTabCount !== undefined) {
    const distinctOpened = new Set(opens.map((e) => e.artifactKey));
    if (opens.length > 0 && distinctOpened.size >= totalTabCount) {
      const span = (opens[opens.length - 1] as ScoringEvent).atMs - (opens[0] as ScoringEvent).atMs;
      if (span < CLICK_THROUGH_WINDOW_MS) efficiency = 0.3;
    }
  }

  // Deliberation: an artifact was opened before any answer was selected.
  const firstOpenMs = opens.length > 0 ? (opens[0] as ScoringEvent).atMs : null;
  const firstAnswerMs = response?.firstAnswerSelectMs ?? response?.firstInteractionMs ?? null;
  const deliberation = firstOpenMs !== null && firstAnswerMs !== null && firstOpenMs < firstAnswerMs ? 1 : 0;

  const pI = 0.5 * evidence + 0.3 * efficiency + 0.2 * deliberation;
  return { pI, evidence, efficiency, deliberation, decisiveArtifactOpened: evidence === 1 };
}

// ---------------------------------------------------------------------------
// Pillar scores — SCORING.md §3
// ---------------------------------------------------------------------------

function weightedAccuracy(items: ScoringItem[], scores: Map<number, ItemScoreResult>): number {
  let num = 0;
  let den = 0;
  for (const item of items) {
    const w = DIFFICULTY_WEIGHT[item.difficulty];
    const s = scores.get(item.position)?.sI ?? 0;
    num += w * s;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface BlockBreakdown {
  key: string;
  correct?: number;
  wrong?: number;
  skipped?: number;
  expired?: number;
  score: number;
  medianU?: number;
  correctQ1?: number;
  correctQ2?: number;
  correctQ3?: number;
  process?: number;
}

export interface ItemBreakdown {
  pos: number;
  block: string;
  template: string;
  difficulty: Difficulty;
  s: number;
  responseMs: number | null;
  limitMs: number;
  firstMs: number | null;
  changes: number;
  outageCreditMs?: number;
}

export interface ScoreSessionResult {
  scoreReasoning: number;
  scoreIndependence: number;
  scoreTech: number;
  scoreSpeed: number;
  scoreOverall: number;
  confidence: number;
  itemsAnswered: number;
  itemsExpired: number;
  itemsCorrect: number;
  medianResponseMs: number | null;
  breakdown: {
    blocks: BlockBreakdown[];
    items: ItemBreakdown[];
    guessedItems: number;
    accuracyOverall: number;
  };
}

export function scoreSession(input: ScoreSessionInput): ScoreSessionResult {
  const { items, responses, events, blueprint } = input;
  const responseByPos = new Map(responses.map((r) => [r.position, r]));

  const itemScores = new Map<number, ItemScoreResult>();
  for (const item of items) {
    const response = responseByPos.get(item.position);
    if (!response || response.status !== "answered") {
      itemScores.set(item.position, { sI: 0, isCorrect: false });
      continue;
    }
    itemScores.set(item.position, scoreItem(item.kind, response.answer, item.answerKey));
  }

  const eventsByPos = new Map<number, ScoringEvent[]>();
  for (const e of events) {
    const list = eventsByPos.get(e.position) ?? [];
    list.push(e);
    eventsByPos.set(e.position, list);
  }

  const investigationItems = items.filter((i) => i.kind === "investigation");
  const processByPos = new Map<number, ProcessScoreResult>();
  for (const item of investigationItems) {
    const response = responseByPos.get(item.position);
    processByPos.set(item.position, computeProcessScore(item, response, eventsByPos.get(item.position) ?? []));
  }
  const decisiveOpenedMap = new Map<number, boolean>(
    [...processByPos.entries()].map(([pos, p]) => [pos, p.decisiveArtifactOpened]),
  );

  const guesses = computeGuesses(items, responseByPos, itemScores, decisiveOpenedMap);

  // ---- Reasoning ----
  const reasoningItems = items.filter((i) => i.blockKey === "reasoning");
  const R = Math.round(100 * weightedAccuracy(reasoningItems, itemScores));

  // ---- Tech ----
  const techItems = items.filter((i) => i.blockKey === "tech");
  const T = Math.round(100 * weightedAccuracy(techItems, itemScores));

  // ---- Independence ----
  const iCorrect = weightedAccuracy(investigationItems, itemScores);
  const processValues = investigationItems.map((i) => processByPos.get(i.position)?.pI ?? 0);
  const iProcess = processValues.length > 0 ? processValues.reduce((a, b) => a + b, 0) / processValues.length : 0;
  const iRaw = 0.7 * iCorrect + 0.3 * iProcess;
  // SCORING.md §3.3's guess_penalty references the same session-wide
  // "guessed_items" that §3.5 displays as "ניחושים: k" — not just
  // investigation-block guesses. The worked example (§10) confirms this: its
  // one guessed item is in the speed block, yet it still docks Independence
  // by 2. "includes blind guesses in this block" (§3.3) means investigation
  // blind guesses are folded into that same global count, not that the
  // penalty is scoped to the investigation block alone.
  const totalGuessedItems = [...guesses.values()].filter((g) => g.guessed).length;
  const guessPenalty = Math.min(6, 2 * totalGuessedItems);
  const I = clamp(Math.round(100 * iRaw) - guessPenalty, 0, 100);

  // ---- Speed ----
  const speedItems = items.filter((i) => i.blockKey === "speed");
  let speedRaw = 0;
  for (const item of speedItems) {
    const response = responseByPos.get(item.position);
    const score = itemScores.get(item.position);
    if (!response || response.status === "skipped") continue;
    if (response.status === "expired") continue;
    if (score?.isCorrect) speedRaw += 1;
    else speedRaw -= 0.5;
  }
  const sBlock = clamp(speedRaw / (speedItems.length || 1), 0, 1);

  const uValues: number[] = [];
  for (const item of items) {
    const response = responseByPos.get(item.position);
    const score = itemScores.get(item.position);
    if (!response || response.responseMs === null || !score || score.sI < 0.75) continue;
    uValues.push(response.responseMs / (item.timeLimitS * 1000));
  }
  const medianU = uValues.length >= 8 ? median(uValues) : null;
  const paceRaw = medianU !== null ? 1 - medianU : sBlock;
  const sPace = clamp((paceRaw - 0.15) / 0.65, 0, 1);

  let sRaw = 0.6 * sBlock + 0.4 * sPace;
  const servedItems = items.filter((i) => responseByPos.get(i.position)?.status !== undefined);
  const accuracyOverall =
    servedItems.length > 0
      ? servedItems.reduce((sum, i) => sum + (itemScores.get(i.position)?.sI ?? 0), 0) / servedItems.length
      : 0;
  if (accuracyOverall < 0.6) sRaw = Math.min(sRaw, 0.5);
  const S = Math.round(100 * sRaw);

  // ---- Overall ----
  const weights = blueprint.weights;
  const overall = Math.round(
    (weights.reasoning ?? 0.3) * R +
      (weights.independence ?? 0.3) * I +
      (weights.tech ?? 0.25) * T +
      (weights.speed ?? 0.15) * S,
  );

  // ---- Confidence — SCORING.md §5 ----
  const finalizedCount = responses.filter((r) => r.status === "answered" || r.status === "expired").length;
  const confidence = items.length > 0 ? finalizedCount / items.length : 0;

  // ---- Breakdown (§7) ----
  const blockOf = (key: string): ScoringItem[] => items.filter((i) => i.blockKey === key);
  const countStatus = (blockItems: ScoringItem[], status: ResponseStatus, correctOnly?: boolean) =>
    blockItems.filter((i) => {
      const r = responseByPos.get(i.position);
      if (!r || r.status !== status) return false;
      if (correctOnly === undefined) return true;
      const correct = itemScores.get(i.position)?.isCorrect ?? false;
      return correctOnly ? correct : !correct;
    }).length;

  const blocks: BlockBreakdown[] = [];
  const speedBlockItems = blockOf("speed");
  blocks.push({
    key: "speed",
    correct: countStatus(speedBlockItems, "answered", true),
    wrong: countStatus(speedBlockItems, "answered", false),
    skipped: countStatus(speedBlockItems, "skipped"),
    expired: countStatus(speedBlockItems, "expired"),
    score: S,
    medianU: medianU ?? undefined,
  });
  const reasoningBlockItems = blockOf("reasoning");
  blocks.push({
    key: "reasoning",
    correct: countStatus(reasoningBlockItems, "answered", true),
    wrong: countStatus(reasoningBlockItems, "answered", false),
    skipped: countStatus(reasoningBlockItems, "skipped"),
    expired: countStatus(reasoningBlockItems, "expired"),
    score: R,
  });
  const techBlockItems = blockOf("tech");
  blocks.push({
    key: "tech",
    correct: countStatus(techBlockItems, "answered", true),
    wrong: countStatus(techBlockItems, "answered", false),
    skipped: countStatus(techBlockItems, "skipped"),
    expired: countStatus(techBlockItems, "expired"),
    score: T,
  });

  const investigateAnswered = investigationItems.filter((i) => responseByPos.get(i.position)?.status === "answered");
  const q1Correct = investigateAnswered.filter((i) => itemScores.get(i.position)?.isCorrect).length;
  blocks.push({
    key: "investigate",
    correctQ1: q1Correct,
    process: Number(iProcess.toFixed(2)),
    score: I,
  });

  const itemsBreakdown: ItemBreakdown[] = items.map((item) => {
    const response = responseByPos.get(item.position);
    return {
      pos: item.position,
      block: item.blockKey,
      template: item.templateId,
      difficulty: item.difficulty,
      s: itemScores.get(item.position)?.sI ?? 0,
      responseMs: response?.responseMs ?? null,
      limitMs: item.timeLimitS * 1000,
      firstMs: response?.firstInteractionMs ?? null,
      changes: response?.answerChanges ?? 0,
      outageCreditMs: item.outageCreditMs,
    };
  });

  const allResponseMs = responses.filter((r) => r.responseMs !== null).map((r) => r.responseMs as number);
  const medianResponseMs = allResponseMs.length > 0 ? median(allResponseMs) : null;

  return {
    scoreReasoning: R,
    scoreIndependence: I,
    scoreTech: T,
    scoreSpeed: S,
    scoreOverall: overall,
    confidence: Number(confidence.toFixed(2)),
    itemsAnswered: responses.filter((r) => r.status === "answered").length,
    itemsExpired: responses.filter((r) => r.status === "expired").length,
    itemsCorrect: items.filter((i) => itemScores.get(i.position)?.isCorrect).length,
    medianResponseMs,
    breakdown: {
      blocks,
      items: itemsBreakdown,
      guessedItems: totalGuessedItems,
      accuracyOverall: Number(accuracyOverall.toFixed(2)),
    },
  };
}

// ---------------------------------------------------------------------------
// Bands — SCORING.md §4
// ---------------------------------------------------------------------------

export type Band = "exceptional" | "high" | "medium" | "low";

export function bandFor(score: number): Band {
  if (score >= 80) return "exceptional";
  if (score >= 65) return "high";
  if (score >= 50) return "medium";
  return "low";
}
