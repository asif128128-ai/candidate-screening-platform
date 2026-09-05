import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_WEIGHT,
  bandFor,
  scoreItem,
  scoreSession,
  type ScoringEvent,
  type ScoringItem,
  type ScoringResponse,
} from "@/assessment/scoring";
import type { AnswerKey, InvestigationAnswerKey } from "@/assessment/types";

// ---------------------------------------------------------------------------
// §2 — scoreItem, per item kind
// ---------------------------------------------------------------------------
describe("scoreItem — single_choice", () => {
  const key: AnswerKey = { kind: "single_choice", correctIndex: 2 };
  it("scores 1 for the correct index", () => {
    expect(scoreItem("single_choice", { selectedIndex: 2 }, key).sI).toBe(1);
    expect(scoreItem("single_choice", { selectedIndex: 2 }, key).isCorrect).toBe(true);
  });
  it("scores 0 for any wrong index", () => {
    for (const i of [0, 1, 3]) {
      expect(scoreItem("single_choice", { selectedIndex: i }, key).sI).toBe(0);
    }
  });
  it("scores 0 when nothing was selected (skip/expired)", () => {
    expect(scoreItem("single_choice", { selectedIndex: null }, key).sI).toBe(0);
    expect(scoreItem("single_choice", null, key).sI).toBe(0);
  });
});

describe("scoreItem — multi_choice (Jaccard-with-penalty, SCORING.md §2)", () => {
  const key: AnswerKey = { kind: "multi_choice", correctIndexes: [0, 2, 4] };
  it("scores 1 for an exact match", () => {
    expect(scoreItem("multi_choice", { selectedIndexes: [0, 2, 4] }, key).sI).toBe(1);
  });
  it("applies the max(0, |S∩C| - |S\\C|) / |C| formula for partial matches", () => {
    // S = {0, 2}: intersect=2, sMinusC=0 -> (2-0)/3 = 0.667
    expect(scoreItem("multi_choice", { selectedIndexes: [0, 2] }, key).sI).toBeCloseTo(2 / 3, 5);
    // S = {0, 2, 4, 1}: intersect=3, sMinusC=1 -> (3-1)/3 = 0.667
    expect(scoreItem("multi_choice", { selectedIndexes: [0, 2, 4, 1] }, key).sI).toBeCloseTo(2 / 3, 5);
    // S = {1, 3}: intersect=0, sMinusC=2 -> max(0, -2)/3 = 0
    expect(scoreItem("multi_choice", { selectedIndexes: [1, 3] }, key).sI).toBe(0);
  });
  it("never goes negative even when every selection is wrong", () => {
    const r = scoreItem("multi_choice", { selectedIndexes: [1, 3, 5, 6] }, key);
    expect(r.sI).toBe(0);
  });
});

describe("scoreItem — numeric", () => {
  it("matches exactly with zero tolerance by default", () => {
    const key: AnswerKey = { kind: "numeric", correctValue: 42 };
    expect(scoreItem("numeric", { value: 42 }, key).sI).toBe(1);
    expect(scoreItem("numeric", { value: 42.001 }, key).sI).toBe(0);
    expect(scoreItem("numeric", { value: "42" }, key).sI).toBe(1);
  });
  it("respects a declared tolerance", () => {
    const key: AnswerKey = { kind: "numeric", correctValue: 100, tolerance: 2 };
    expect(scoreItem("numeric", { value: 98 }, key).sI).toBe(1);
    expect(scoreItem("numeric", { value: 102 }, key).sI).toBe(1);
    expect(scoreItem("numeric", { value: 97 }, key).sI).toBe(0);
  });
  it("scores 0 for non-numeric or empty input", () => {
    const key: AnswerKey = { kind: "numeric", correctValue: 1 };
    expect(scoreItem("numeric", { value: "abc" }, key).sI).toBe(0);
    expect(scoreItem("numeric", { value: "" }, key).sI).toBe(0);
    expect(scoreItem("numeric", { value: null }, key).sI).toBe(0);
  });
});

describe("scoreItem — short_text (normalization, SCORING.md §2)", () => {
  const key: AnswerKey = { kind: "short_text", correctText: "A-77312" };
  it("matches exactly", () => {
    expect(scoreItem("short_text", { text: "A-77312" }, key).sI).toBe(1);
  });
  it("is tolerant of surrounding whitespace, case, and collapsed internal spaces", () => {
    expect(scoreItem("short_text", { text: "  a-77312  " }, key).sI).toBe(1);
  });
  it("strips surrounding quotes/brackets", () => {
    const key2: AnswerKey = { kind: "short_text", correctText: "example.co.il" };
    expect(scoreItem("short_text", { text: '"example.co.il"' }, key2).sI).toBe(1);
    expect(scoreItem("short_text", { text: "[example.co.il]" }, key2).sI).toBe(1);
  });
  it("accepts declared alternates", () => {
    const key2: AnswerKey = { kind: "short_text", correctText: "1, 2, 3", acceptedAlternates: ["1,2,3"] };
    expect(scoreItem("short_text", { text: "1,2,3" }, key2).sI).toBe(1);
  });
  it("scores 0 for a wrong answer", () => {
    expect(scoreItem("short_text", { text: "A-99999" }, key).sI).toBe(0);
  });
});

describe("scoreItem — ordering (Kendall-tau, SCORING.md §2)", () => {
  const key: AnswerKey = { kind: "ordering", correctOrder: [2, 0, 1, 3] };
  it("scores 1 for the exact correct order", () => {
    expect(scoreItem("ordering", { order: [2, 0, 1, 3] }, key).sI).toBe(1);
  });
  it("scores 0 for the fully reversed order (maximum inversions)", () => {
    expect(scoreItem("ordering", { order: [3, 1, 0, 2] }, key).sI).toBe(0);
  });
  it("gives partial credit proportional to inversions", () => {
    // one adjacent swap from correct: 1 inversion out of maxInversions=6
    const r = scoreItem("ordering", { order: [0, 2, 1, 3] }, key);
    expect(r.sI).toBeCloseTo(1 - (2 * 1) / 6, 5);
  });
  it("scores 0 for an invalid permutation (wrong length or duplicates)", () => {
    expect(scoreItem("ordering", { order: [0, 1, 2] }, key).sI).toBe(0);
    expect(scoreItem("ordering", { order: [0, 0, 1, 3] }, key).sI).toBe(0);
  });
});

describe("scoreItem — investigation composite (0.5/0.25/0.25, SCORING.md §2)", () => {
  const key: InvestigationAnswerKey = {
    kind: "investigation",
    q1CorrectIndex: 1,
    q2CorrectIndex: 0,
    q3CorrectText: "A-1234",
    decisiveArtifactKeyQ1: "settings",
    decisiveArtifactKeyQ3: "log",
    q2IsEscalation: false,
    q2HasNoEvidenceEscalationDistractor: true,
  };
  it("scores 1.0 when all three sub-answers are correct", () => {
    const r = scoreItem("investigation", { q1: 1, q2: 0, q3: "A-1234" }, key);
    expect(r.sI).toBe(1);
    expect(r.isCorrect).toBe(true);
  });
  it("scores 0.5 for wrong root cause but correct action + fact (SCORING.md §10 worked example, scene B)", () => {
    const r = scoreItem("investigation", { q1: 0, q2: 0, q3: "A-1234" }, key);
    expect(r.sI).toBeCloseTo(0.5, 10);
    expect(r.isCorrect).toBe(false); // headline correctness is root-cause (q1)
  });
  it("scores 0.75 for correct root cause + fact, wrong action (SCORING.md §10 worked example, scene D)", () => {
    const r = scoreItem("investigation", { q1: 1, q2: 5, q3: "A-1234" }, key);
    expect(r.sI).toBeCloseTo(0.75, 10);
    expect(r.isCorrect).toBe(true);
  });
  it("scores 0 when nothing is answered", () => {
    expect(scoreItem("investigation", { q1: null, q2: null, q3: null }, key).sI).toBe(0);
  });
});

describe("DIFFICULTY_WEIGHT", () => {
  it("matches SCORING.md §2 exactly", () => {
    expect(DIFFICULTY_WEIGHT).toEqual({ 1: 1.0, 2: 1.3, 3: 1.7 });
  });
});

describe("bandFor", () => {
  it("matches the SCORING.md §4 band table", () => {
    expect(bandFor(100)).toBe("exceptional");
    expect(bandFor(80)).toBe("exceptional");
    expect(bandFor(79)).toBe("high");
    expect(bandFor(65)).toBe("high");
    expect(bandFor(64)).toBe("medium");
    expect(bandFor(50)).toBe("medium");
    expect(bandFor(49)).toBe("low");
    expect(bandFor(0)).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// scoreSession — full session assembly, reproducing SCORING.md §10's worked
// example EXACTLY so the formula can never silently drift.
// ---------------------------------------------------------------------------

function choiceItem(
  position: number,
  blockKey: ScoringItem["blockKey"],
  pillar: ScoringItem["pillar"],
  difficulty: 1 | 2 | 3,
  timeLimitS: number,
): ScoringItem {
  return {
    position,
    blockKey,
    pillar,
    kind: "single_choice",
    difficulty,
    timeLimitS,
    templateId: `${blockKey}.synthetic`,
    answerKey: { kind: "single_choice", correctIndex: 0 },
  };
}

function correctResponse(position: number, responseMs: number): ScoringResponse {
  return {
    position,
    status: "answered",
    answer: { selectedIndex: 0 },
    responseMs,
    firstInteractionMs: 500,
    answerChanges: 0,
  };
}

function wrongResponse(position: number, responseMs: number): ScoringResponse {
  return {
    position,
    status: "answered",
    answer: { selectedIndex: 1 },
    responseMs,
    firstInteractionMs: 500,
    answerChanges: 0,
  };
}

function skipResponse(position: number): ScoringResponse {
  return { position, status: "skipped", answer: null, responseMs: null, firstInteractionMs: null, answerChanges: 0 };
}

function investigationItem(
  position: number,
  difficulty: 1 | 2 | 3,
  decisiveKey = "decisive",
): ScoringItem {
  const answerKey: InvestigationAnswerKey = {
    kind: "investigation",
    q1CorrectIndex: 0,
    q2CorrectIndex: 0,
    q3CorrectText: "FACT",
    decisiveArtifactKeyQ1: decisiveKey,
    decisiveArtifactKeyQ3: decisiveKey,
    q2IsEscalation: false,
    q2HasNoEvidenceEscalationDistractor: true,
  };
  return {
    position,
    blockKey: "investigate",
    pillar: "independence",
    kind: "investigation",
    difficulty,
    timeLimitS: 180,
    templateId: "investigate.synthetic",
    answerKey,
    artifactKeys: [decisiveKey, "other", "other2", "decoy"],
  };
}

function buildWorkedExample(): { items: ScoringItem[]; responses: ScoringResponse[]; events: ScoringEvent[] } {
  const items: ScoringItem[] = [];
  const responses: ScoringResponse[] = [];
  const events: ScoringEvent[] = [];
  let pos = 1;

  // --- Speed: 10 items, difficulty 1, 20s limit. 8 correct / 1 wrong (fast, the one guess) / 1 skip.
  const speedCorrectU = 0.48 * 20000; // = 9600ms, one of the 22 qualifying pace items
  for (let i = 0; i < 8; i++) {
    items.push(choiceItem(pos, "speed", "speed", 1, 20));
    responses.push(correctResponse(pos, speedCorrectU));
    pos++;
  }
  items.push(choiceItem(pos, "speed", "speed", 1, 20));
  responses.push(wrongResponse(pos, 2000)); // fast + wrong = the session's one guess
  pos++;
  items.push(choiceItem(pos, "speed", "speed", 1, 20));
  responses.push(skipResponse(pos));
  pos++;

  // --- Reasoning: difficulties 1,1,2,2,2,3 — correct on all but one difficulty-2.
  const reasoningDifficulties: Array<1 | 2 | 3> = [1, 1, 2, 2, 2, 3];
  let reasoningWrongUsed = false;
  for (const d of reasoningDifficulties) {
    items.push(choiceItem(pos, "reasoning", "reasoning", d, 75));
    if (d === 2 && !reasoningWrongUsed) {
      responses.push(wrongResponse(pos, 70000)); // slow enough to not be a guess
      reasoningWrongUsed = true;
    } else {
      responses.push(correctResponse(pos, 0.48 * 75000));
    }
    pos++;
  }

  // --- Tech: difficulties 1,1,2,2,2,2,3 — correct on all but one difficulty-1.
  const techDifficulties: Array<1 | 2 | 3> = [1, 1, 2, 2, 2, 2, 3];
  let techWrongUsed = false;
  for (const d of techDifficulties) {
    items.push(choiceItem(pos, "tech", "tech", d, 60));
    if (d === 1 && !techWrongUsed) {
      responses.push(wrongResponse(pos, 50000)); // slow enough to not be a guess
      techWrongUsed = true;
    } else {
      responses.push(correctResponse(pos, 0.48 * 60000));
    }
    pos++;
  }

  // --- Investigation: 4 scenes, difficulties 1,2,2,3.
  // Scene A (d1): full credit (1.0), process p_i = 1.0 (evidence+efficiency+deliberation).
  const sceneA = pos;
  items.push(investigationItem(sceneA, 1));
  responses.push({
    position: sceneA,
    status: "answered",
    answer: { q1: 0, q2: 0, q3: "FACT" },
    responseMs: 0.48 * 180000,
    firstInteractionMs: 500,
    answerChanges: 0,
    firstAnswerSelectMs: 5000, // after the artifact open below -> deliberation = 1
  });
  events.push({ position: sceneA, kind: "artifact_open", atMs: 1000, artifactKey: "decisive" });
  pos++;

  // Scene B (d2): wrong root cause, correct action + fact (0.5). Evidence
  // present (not a blind guess) but answered before opening -> deliberation 0.
  // Answered slowly so it is not ALSO flagged by the generic fast-wrong guess rule.
  const sceneB = pos;
  items.push(investigationItem(sceneB, 2));
  responses.push({
    position: sceneB,
    status: "answered",
    answer: { q1: 1, q2: 0, q3: "FACT" }, // q1 wrong (correct is 0), q2/q3 correct
    responseMs: 150000,
    firstInteractionMs: 500,
    answerChanges: 0,
    firstAnswerSelectMs: 500, // before the artifact open -> deliberation = 0
  });
  events.push({ position: sceneB, kind: "artifact_open", atMs: 1000, artifactKey: "decisive" });
  pos++;

  // Scene C (d2): full credit (1.0), process p_i = 1.0.
  const sceneC = pos;
  items.push(investigationItem(sceneC, 2));
  responses.push({
    position: sceneC,
    status: "answered",
    answer: { q1: 0, q2: 0, q3: "FACT" },
    responseMs: 0.48 * 180000,
    firstInteractionMs: 500,
    answerChanges: 0,
    firstAnswerSelectMs: 5000,
  });
  events.push({ position: sceneC, kind: "artifact_open", atMs: 1000, artifactKey: "decisive" });
  pos++;

  // Scene D (d3): correct root cause + fact, wrong action (0.75), process p_i = 0.8.
  const sceneD = pos;
  items.push(investigationItem(sceneD, 3));
  responses.push({
    position: sceneD,
    status: "answered",
    answer: { q1: 0, q2: 1, q3: "FACT" }, // q1/q3 correct, q2 wrong (correct is 0)
    responseMs: 0.48 * 180000,
    firstInteractionMs: 500,
    answerChanges: 0,
    firstAnswerSelectMs: 500, // before the artifact open -> deliberation = 0
  });
  events.push({ position: sceneD, kind: "artifact_open", atMs: 1000, artifactKey: "decisive" });
  pos++;

  return { items, responses, events };
}

describe("scoreSession — SCORING.md §10 worked example", () => {
  const { items, responses, events } = buildWorkedExample();
  const result = scoreSession({
    items,
    responses,
    events,
    blueprint: { weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 } },
  });

  it("reproduces every pillar score exactly", () => {
    expect(result.scoreSpeed).toBe(68);
    expect(result.scoreReasoning).toBe(83);
    expect(result.scoreTech).toBe(89);
    expect(result.scoreIndependence).toBe(81);
  });

  it("reproduces the overall score exactly", () => {
    expect(result.scoreOverall).toBe(82);
  });

  it("reproduces accuracy_overall (22.25/27 = 0.82)", () => {
    expect(result.breakdown.accuracyOverall).toBeCloseTo(22.25 / 27, 2);
  });

  it("counts exactly one guessed item, and it is the fast-wrong speed item, not scene B", () => {
    expect(result.breakdown.guessedItems).toBe(1);
  });

  it("computes full confidence (every item was served and finalized, including the skip)", () => {
    expect(result.confidence).toBe(1);
  });

  it("computes the investigation process mean as 0.90", () => {
    const investigateBlock = result.breakdown.blocks.find((b) => b.key === "investigate");
    expect(investigateBlock?.process).toBeCloseTo(0.9, 5);
  });

  // Regression test (IMPLEMENTATION_STATE.md's interface note for the
  // runner-UI engineer): computeIntegrity's IntegrityResponse.
  // decisiveArtifactOpened must come from scoreSession's own process
  // computation, "not recomputed" — which requires scoreSession to actually
  // expose it somewhere in its public output. Every worked-example scene
  // here opens the decisive artifact (with >= 3s dwell), so every
  // investigation item's breakdown entry must report it opened; every
  // non-investigation item must leave the field undefined (it's not a
  // meaningful concept outside the investigate block).
  it("exposes per-item decisiveArtifactOpened in the breakdown for investigation items only", () => {
    const investigationPositions = new Set(
      items.filter((i) => i.kind === "investigation").map((i) => i.position),
    );
    for (const entry of result.breakdown.items) {
      if (investigationPositions.has(entry.pos)) {
        expect(entry.decisiveArtifactOpened).toBe(true);
      } else {
        expect(entry.decisiveArtifactOpened).toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Red-team finding #2 — a bare >=3s dwell on the decisive tab, with no other
// engagement, used to earn full "evidence" credit (0.5 of the process
// score). That is exactly the behavioral signature of a candidate coached
// to "open tab X and wait 3 seconds" with zero real investigation. Evidence
// now additionally requires either a much longer solo dwell or touching a
// second artifact (see EVIDENCE_STRONG_DWELL_MS in scoring.ts).
// ---------------------------------------------------------------------------
describe("process score — evidence can no longer be farmed by dwell-time alone", () => {
  it("a short dwell (just over 3s) on a single tab scores no evidence credit; a long solo dwell, or a second tab, restores it", () => {
    const build = (responseMs: number, events: ScoringEvent[]) => {
      const item = investigationItem(1, 2);
      const response: ScoringResponse = {
        position: 1,
        status: "answered",
        answer: { q1: 0, q2: 0, q3: "FACT" },
        responseMs,
        firstInteractionMs: 500,
        answerChanges: 0,
        firstAnswerSelectMs: responseMs, // answered right at submit -> deliberation = 1 (opened before answering)
      };
      return scoreSession({
        items: [item],
        responses: [response],
        events,
        blueprint: { weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 } },
      });
    };

    // Gamed pattern: open the decisive tab, wait ~3.5s (just over the bare
    // "opened" bar), submit immediately, never touch any other tab.
    const gamed = build(3500, [{ position: 1, kind: "artifact_open", atMs: 0, artifactKey: "decisive" }]);
    const gamedProcess = gamed.breakdown.blocks.find((b) => b.key === "investigate")?.process ?? -1;
    // efficiency = 1.0 (reached first), deliberation = 1 (opened before
    // answering) but evidence = 0 -> p_i = 0.3 + 0.2 = 0.5, not 1.0.
    expect(gamedProcess).toBeCloseTo(0.5, 5);
    // The decisive artifact was still genuinely "opened" for blind-guess
    // purposes — this fix targets the process score, not that gate.
    expect(gamed.breakdown.items[0]?.decisiveArtifactOpened).toBe(true);

    // Same timing, but a genuinely long solo dwell (10s) on the decisive
    // tab alone restores full evidence credit.
    const longDwell = build(10000, [{ position: 1, kind: "artifact_open", atMs: 0, artifactKey: "decisive" }]);
    const longDwellProcess = longDwell.breakdown.blocks.find((b) => b.key === "investigate")?.process ?? -1;
    expect(longDwellProcess).toBeCloseTo(1.0, 5);

    // Same short 3.5s dwell on the decisive tab, but the candidate also
    // opened a second artifact — corroborates genuine cross-referencing —
    // also restores full evidence credit.
    const secondTab = build(3500, [
      { position: 1, kind: "artifact_open", atMs: 0, artifactKey: "decisive" },
      { position: 1, kind: "artifact_open", atMs: 3500, artifactKey: "other" },
    ]);
    const secondTabProcess = secondTab.breakdown.blocks.find((b) => b.key === "investigate")?.process ?? -1;
    expect(secondTabProcess).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// SCORING.md §3.6 — "skip is never worse than a blind guess" invariant.
// Property test over many randomized behaviors, per TEST_STRATEGY.md §3
// ("skip_dominates_blind_guess" over 10,000 random behaviors).
// ---------------------------------------------------------------------------
describe("scoring.test.ts › skip_dominates_blind_guess", () => {
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("skipping an investigation scene never scores worse than a blind wrong guess on the same scene, over 10,000 random behaviors", () => {
    const rand = mulberry32(20260905);
    const difficulties: Array<1 | 2 | 3> = [1, 2, 2, 3];

    for (let trial = 0; trial < 10000; trial++) {
      // Three other scenes are fixed and identical between the two sessions
      // being compared; only the 4th scene (position 4) differs: skip vs. a
      // blind wrong guess (root cause wrong, decisive artifact never opened).
      const fixedScenes = [1, 2, 3].map((p) => {
        const q1 = rand() < 0.5 ? 0 : 1;
        return {
          pos: p,
          answer: { q1: q1 === 0 ? 0 : 1, q2: rand() < 0.5 ? 0 : 1, q3: rand() < 0.5 ? "FACT" : "WRONG" },
          responseMs: 50000 + rand() * 100000,
          opensDecisive: rand() < 0.5,
        };
      });

      function buildSession(mode: "skip" | "blind_guess") {
        const items: ScoringItem[] = fixedScenes.map((s, i) => investigationItem(s.pos, difficulties[i] as 1 | 2 | 3));
        items.push(investigationItem(4, difficulties[3] as 1 | 2 | 3));

        const responses: ScoringResponse[] = fixedScenes.map((s) => ({
          position: s.pos,
          status: "answered",
          answer: s.answer,
          responseMs: s.responseMs,
          firstInteractionMs: 500,
          answerChanges: 0,
          firstAnswerSelectMs: s.opensDecisive ? 5000 : 500,
        }));

        const events: ScoringEvent[] = fixedScenes
          .filter((s) => s.opensDecisive)
          .map((s) => ({ position: s.pos, kind: "artifact_open" as const, atMs: 1000, artifactKey: "decisive" }));

        if (mode === "skip") {
          // A skip is an explicit submission (the candidate clicked "דלג/י"),
          // so it carries a responseMs like any other response — null would
          // only be a pure timeout with zero interaction, not a skip.
          responses.push({
            position: 4,
            status: "skipped",
            answer: null,
            responseMs: 60000,
            firstInteractionMs: null,
            answerChanges: 0,
          });
          // A candidate can still investigate before skipping — randomize
          // whether they opened the decisive artifact first (with enough
          // dwell to count as a real "open", not a glance).
          if (rand() < 0.5) {
            events.push({ position: 4, kind: "artifact_open", atMs: 1000, artifactKey: "decisive" });
          }
        } else {
          // Blind wrong guess: root cause wrong, decisive artifact NEVER
          // opened, regardless of how long they took (SCORING.md §3.5).
          responses.push({
            position: 4,
            status: "answered",
            answer: { q1: 1, q2: rand() < 0.5 ? 0 : 1, q3: rand() < 0.5 ? "FACT" : "WRONG" },
            responseMs: rand() * 180000,
            firstInteractionMs: 500,
            answerChanges: 0,
            firstAnswerSelectMs: 500,
          });
          // No artifact_open event for position 4 at all.
        }

        return scoreSession({
          items,
          responses,
          events,
          blueprint: { weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 } },
        });
      }

      const skipResult = buildSession("skip");
      const guessResult = buildSession("blind_guess");

      expect(skipResult.scoreIndependence).toBeGreaterThanOrEqual(guessResult.scoreIndependence);
    }
  });
});
