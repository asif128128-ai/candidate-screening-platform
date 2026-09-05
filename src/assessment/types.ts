// Shared types for the assessment engine (generator/bank/scoring/integrity).
// Mirrors the DB shapes in DATA_MODEL.md §3.11-§3.14 closely enough that
// generator output maps 1:1 onto `assessment_items` columns, but these
// types are pure TS with no I/O — the DB layer is someone else's concern
// (the runner UI / API routes, out of this engineer's scope).

import type { Rng } from "./rng";

export type Pillar = "reasoning" | "independence" | "tech" | "speed";
export type BlockKey = "speed" | "reasoning" | "tech" | "investigate";
export type ItemKind =
  | "single_choice"
  | "multi_choice"
  | "numeric"
  | "short_text"
  | "ordering"
  | "investigation";
export type Difficulty = 1 | 2 | 3;

/** An artifact/tab shown alongside a question (investigation items; occasionally tech/speed embed one inline). */
export interface Artifact {
  key: string;
  label: string;
  /** Rendered body. Plain text/markdown-lite; the runner UI decides how to lay it out. */
  body: string;
  /** True for the scenario's decoy tab (ASSESSMENT_DESIGN.md §3.3: "one of which is always a decoy"). */
  decoy?: boolean;
}

export interface ChoiceContent {
  prompt: string;
  /** Rendered option text, already in the final (shuffled) display order. */
  options: string[];
  artifacts?: Artifact[];
}

export interface NumericContent {
  prompt: string;
  artifacts?: Artifact[];
  unit?: string;
}

export interface ShortTextContent {
  prompt: string;
  artifacts?: Artifact[];
  placeholder?: string;
}

export interface OrderingContent {
  prompt: string;
  /** The events/steps to order, already in shuffled (candidate-facing) order. */
  items: string[];
}

export interface InvestigationSubQuestion {
  prompt: string;
  options: string[];
}

export interface InvestigationContent {
  ticket: string;
  tabs: Artifact[];
  q1: InvestigationSubQuestion; // root cause
  q2: InvestigationSubQuestion; // first action now
  q3: { prompt: string; placeholder?: string }; // extract a fact (short text)
}

export type ItemContent =
  | ChoiceContent
  | NumericContent
  | ShortTextContent
  | OrderingContent
  | InvestigationContent;

export interface SingleChoiceAnswerKey {
  kind: "single_choice";
  correctIndex: number;
}
export interface MultiChoiceAnswerKey {
  kind: "multi_choice";
  correctIndexes: number[];
}
export interface NumericAnswerKey {
  kind: "numeric";
  correctValue: number;
  tolerance?: number;
}
export interface ShortTextAnswerKey {
  kind: "short_text";
  correctText: string;
  /** Alternate accepted normalized forms (e.g. with/without leading zero). */
  acceptedAlternates?: string[];
}
export interface OrderingAnswerKey {
  kind: "ordering";
  /** Correct order expressed as indices into content.items (the shuffled/displayed array). */
  correctOrder: number[];
}
export interface InvestigationAnswerKey {
  kind: "investigation";
  q1CorrectIndex: number;
  q2CorrectIndex: number;
  q3CorrectText: string;
  q3AcceptedAlternates?: string[];
  /** Key of the tab that is decisive for q1 (used by process scoring, SCORING.md §3.3). */
  decisiveArtifactKeyQ1: string;
  /** Key of the tab that contains the fact for q3 (audit-checked to be unique to this tab). */
  decisiveArtifactKeyQ3: string;
  /** Whether the correct q2 option is escalation-with-proposal (DECISIONS_LOG.md #6). */
  q2IsEscalation: boolean;
  /** Whether a no-evidence-escalation distractor is present among q2 options. */
  q2HasNoEvidenceEscalationDistractor: boolean;
}

export type AnswerKey =
  | SingleChoiceAnswerKey
  | MultiChoiceAnswerKey
  | NumericAnswerKey
  | ShortTextAnswerKey
  | OrderingAnswerKey
  | InvestigationAnswerKey;

/** What generator.ts produces per item; maps onto assessment_items columns. */
export interface GeneratedItem {
  position: number;
  blockKey: BlockKey;
  pillar: Pillar;
  templateId: string;
  templateVersion: number;
  variantSeed: bigint;
  kind: ItemKind;
  difficulty: Difficulty;
  timeLimitS: number;
  content: ItemContent;
  answerKey: AnswerKey;
  /** ASSESSMENT_DESIGN.md §3 "the convention is in the item" rule; 'n/a' when derivable from the artifact alone. */
  conventionsStated: string | "n/a";
  /** ASSESSMENT_DESIGN.md §3.1: families that lean on CS-course fluency even with the convention stated. */
  fluency?: boolean;
}

/** A template family as described in ASSESSMENT_DESIGN.md §4.1. Pure, no I/O. */
export interface ItemTemplate {
  id: string;
  version: number;
  pillar: Pillar;
  kind: ItemKind;
  difficulties: readonly Difficulty[];
  conventionsStated: string | "n/a";
  fluency?: boolean;
  /** Speed-only: this family is limited to at most one instance per session (ASSESSMENT_DESIGN.md §3.1, speed.bool_logic). */
  maxOncePerSession?: boolean;
  generate(
    rng: Rng,
    difficulty: Difficulty,
  ): {
    content: ItemContent;
    answerKey: AnswerKey;
    /**
     * Per-instance override of the template's static `conventionsStated`,
     * for templates whose embedded convention text varies by draw (e.g.
     * tech.http_status_next picks one of several doc excerpts). The bank
     * audit (ASSESSMENT_DESIGN.md §4.4) checks that this exact text appears
     * verbatim in the rendered content. Falls back to the template's static
     * declaration when omitted.
     */
    conventionsStated?: string | "n/a";
  };
}

export type Cause = "a" | "b" | "c";

/**
 * An investigation scenario family: 3 cause variants sharing a "shape", per
 * ASSESSMENT_DESIGN.md §3.3. Whether a cause variant's correct q2 answer is
 * a hands-on fix or an escalation-with-proposal (DECISIONS_LOG.md #6) is
 * intrinsic to the cause (declared in `escalationCauses`), not a session-
 * level choice — the generator picks *which* scenario+cause combinations
 * appear in a session so that the session-level escalation invariants
 * (ASSESSMENT_DESIGN.md §3.3, §4.2) hold.
 */
export interface InvestigationScenario {
  id: string; // 'investigate.webhook_missing'
  version: number;
  causeVariants: readonly ["a", "b", "c"];
  /** Which cause variants require escalation-with-proposal rather than a hands-on fix. */
  escalationCauses: readonly Cause[];
  /** Builds one concrete instance for a given cause + difficulty. */
  generate(
    rng: Rng,
    cause: Cause,
    difficulty: Difficulty,
  ): { content: InvestigationContent; answerKey: InvestigationAnswerKey };
}

export type AntiPatternKind =
  | "escalate_no_evidence"
  | "irreversible_action"
  | "treat_symptom"
  | "fix_decoy"
  | "wait_and_see"
  | "busywork_gather_more";
