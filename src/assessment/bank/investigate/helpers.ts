// Shared plumbing for investigation scenarios (ASSESSMENT_DESIGN.md §3.3).
// Each scenario file builds a "world" per cause variant and hands the
// q1/q2/q3 pieces to buildInvestigationItem(), which assembles the final
// InvestigationContent/InvestigationAnswerKey, including the rotating
// next-action distractor pool (DECISIONS_LOG.md #6).
import type { Rng } from "../../rng";
import type { AntiPatternKind, Artifact, InvestigationAnswerKey, InvestigationContent } from "../../types";

export interface AntiPatternTexts {
  escalate_no_evidence: string;
  irreversible_action: string;
  treat_symptom: string;
  fix_decoy: string;
  wait_and_see: string;
  busywork_gather_more: string;
}

/** Generic phrasing for the two anti-patterns that read the same regardless of scenario. */
export function genericAntiPatterns(partial: {
  irreversible_action: string;
  treat_symptom: string;
  fix_decoy: string;
  busywork_gather_more: string;
}): AntiPatternTexts {
  return {
    escalate_no_evidence:
      "לפתוח פנייה למנהל/ת ולתאר בקצרה את התקלה בדיוק כפי שדווחה בכרטיס המקורי, ולבקש הנחיה מפורשת על הצעד הבא לפני שבודקים משהו בעצמך",
    wait_and_see:
      "לסמן את הכרטיס כ'בבדיקה' ולחכות בסבלנות עד מחר לראות אם התקלה חוזרת על עצמה מחדש או נעלמת לבד בלי שום התערבות",
    ...partial,
  };
}

export interface Q1Option {
  text: string;
  correct?: boolean;
}

export interface VariantWorld {
  ticket: string;
  tabs: Artifact[]; // must include exactly one artifact with decoy: true
  decisiveArtifactKeyQ1: string;
  decisiveArtifactKeyQ3: string;
  q1Options: Q1Option[]; // exactly one with correct: true
  /** The specific, scenario-tailored question for sub-question 3 (ASSESSMENT_DESIGN.md §3.3's worked example asks e.g. "מה מספר ההזמנה הראשונה שנכשלה?", never a generic prompt). */
  q3Prompt: string;
  q3Fact: string;
  q3Alternates?: string[];
  correctActionText: string;
  isEscalationRequired: boolean;
  antiPatterns: AntiPatternTexts;
}

/** Assembles the final content/answerKey from a built world. */
export function buildInvestigationItem(
  rng: Rng,
  world: VariantWorld,
): { content: InvestigationContent; answerKey: InvestigationAnswerKey } {
  const correctQ1 = world.q1Options.find((o) => o.correct);
  if (!correctQ1) throw new Error("investigation world: no correct q1 option declared");
  const q1Shuffled = rng.shuffle(world.q1Options);
  const q1CorrectIndex = q1Shuffled.findIndex((o) => o.correct);

  // q2: correct action is always world.correctActionText (either the
  // hands-on fix or, for escalation-required variants, the
  // escalate-with-evidence-and-proposal action). Distractors are drawn per
  // instance from the rotating anti-pattern pool (ASSESSMENT_DESIGN.md
  // §3.3); escalation-required variants always keep "ask without evidence"
  // as one of them (DECISIONS_LOG.md #6).
  const kinds: AntiPatternKind[] = pickDistractorKinds(rng, world.isEscalationRequired);
  const distractorTexts = kinds.map((k) => world.antiPatterns[k]);
  const q2Tagged = rng.shuffle([
    { text: world.correctActionText, correct: true },
    ...distractorTexts.map((text) => ({ text, correct: false })),
  ]);
  const q2CorrectIndex = q2Tagged.findIndex((o) => o.correct);
  // True whenever "ask without evidence" is present as a *distractor* — for
  // an escalation-required scene it always is (pickDistractorKinds keeps it
  // deliberately), which is exactly what satisfies the second session-level
  // invariant (ASSESSMENT_DESIGN.md §3.3 / DECISIONS_LOG.md #6) at the same
  // time as the first.
  const hasNoEvidenceEscalationDistractor = kinds.includes("escalate_no_evidence");

  const content: InvestigationContent = {
    ticket: world.ticket,
    tabs: world.tabs,
    q1: { prompt: "מה שורש הבעיה?", options: q1Shuffled.map((o) => o.text) },
    q2: { prompt: "מה הפעולה הראשונה שלך עכשיו?", options: q2Tagged.map((o) => o.text) },
    q3: { prompt: world.q3Prompt },
  };

  const answerKey: InvestigationAnswerKey = {
    kind: "investigation",
    q1CorrectIndex,
    q2CorrectIndex,
    q3CorrectText: world.q3Fact,
    q3AcceptedAlternates: world.q3Alternates,
    decisiveArtifactKeyQ1: world.decisiveArtifactKeyQ1,
    decisiveArtifactKeyQ3: world.decisiveArtifactKeyQ3,
    q2IsEscalation: world.isEscalationRequired,
    q2HasNoEvidenceEscalationDistractor: hasNoEvidenceEscalationDistractor,
  };

  return { content, answerKey };
}

/**
 * Picks 3 distinct anti-pattern kinds for this scene's q2 distractors. For
 * an escalation-required variant, DECISIONS_LOG.md #6 requires
 * "escalate_no_evidence" to remain among the distractors (asking without a
 * proposal is still wrong even when escalating is the right instinct).
 */
function pickDistractorKinds(rng: Rng, isEscalationRequired: boolean): AntiPatternKind[] {
  const ALL: AntiPatternKind[] = [
    "escalate_no_evidence",
    "irreversible_action",
    "treat_symptom",
    "fix_decoy",
    "wait_and_see",
    "busywork_gather_more",
  ];
  if (isEscalationRequired) {
    const rest = ALL.filter((k) => k !== "escalate_no_evidence");
    return ["escalate_no_evidence", ...rng.sample(rest, 2)];
  }
  return rng.sample(ALL, 3);
}
