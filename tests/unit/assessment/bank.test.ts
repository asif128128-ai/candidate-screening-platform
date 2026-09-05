import { describe, expect, it } from "vitest";
import { ALL_CHOICE_TEMPLATES, INVESTIGATION_SCENARIOS, REASONING_TEMPLATES, SPEED_TEMPLATES, TECH_TEMPLATES } from "@/assessment/bank";
import { createRng, deriveItemSeed } from "@/assessment/rng";
import { scoreItem, type CandidateAnswer } from "@/assessment/scoring";
import type { AnswerKey, Difficulty, InvestigationAnswerKey } from "@/assessment/types";

function correctAnswerFor(kind: string, key: AnswerKey): CandidateAnswer {
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

describe("bank registry sizes match ASSESSMENT_DESIGN.md §4.3", () => {
  it("14 speed + 12 reasoning + 14 tech = 40 choice templates; 12 investigation scenarios", () => {
    expect(SPEED_TEMPLATES).toHaveLength(14);
    expect(REASONING_TEMPLATES).toHaveLength(12);
    expect(TECH_TEMPLATES).toHaveLength(14);
    expect(ALL_CHOICE_TEMPLATES).toHaveLength(40);
    expect(INVESTIGATION_SCENARIOS).toHaveLength(12);
  });

  it("every template id is unique and prefixed with its pillar's bank folder", () => {
    const ids = ALL_CHOICE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of SPEED_TEMPLATES) expect(t.id.startsWith("speed.")).toBe(true);
    for (const t of REASONING_TEMPLATES) expect(t.id.startsWith("reasoning.")).toBe(true);
    for (const t of TECH_TEMPLATES) expect(t.id.startsWith("tech.")).toBe(true);
  });

  it("every investigation scenario id is unique and has exactly 3 cause variants", () => {
    const ids = INVESTIGATION_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of INVESTIGATION_SCENARIOS) {
      expect(s.id.startsWith("investigate.")).toBe(true);
      expect(s.causeVariants).toEqual(["a", "b", "c"]);
    }
  });

  it("exactly the four documented cause variants are escalation-required (DECISIONS_LOG.md #6)", () => {
    const escalationPairs = INVESTIGATION_SCENARIOS.flatMap((s) => s.escalationCauses.map((c) => `${s.id}:${c}`));
    expect(escalationPairs.sort()).toEqual(
      [
        "investigate.webhook_missing:c",
        "investigate.sso_login_subset:c",
        "investigate.backup_silently_failing:b",
        "investigate.saas_seat_limit:a",
      ].sort(),
    );
  });
});

describe("every choice template: correctness roundtrip across difficulties and many seeds", () => {
  const SEED_COUNT = 30;

  for (const template of ALL_CHOICE_TEMPLATES) {
    it(`${template.id} — generates a scoreable, well-formed item for every declared difficulty`, () => {
      for (const difficulty of template.difficulties) {
        for (let i = 0; i < SEED_COUNT; i++) {
          const seed = deriveItemSeed(BigInt(i) * 97n + 13n, template.id, i);
          const rng = createRng(seed);
          const generated = template.generate(rng, difficulty as Difficulty);
          const { content, answerKey } = generated;

          // Correct answer scores 1.
          const correct = correctAnswerFor(template.kind, answerKey);
          const result = scoreItem(template.kind, correct, answerKey);
          expect(result.sI, `${template.id} d${difficulty} seed${i}`).toBe(1);

          // Kind-specific structural sanity.
          if (template.kind === "single_choice" || template.kind === "multi_choice") {
            const options = (content as { options: string[] }).options;
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(new Set(options).size).toBe(options.length);
          }
          if (template.kind === "ordering") {
            const items = (content as { items: string[] }).items;
            const order = (answerKey as Extract<AnswerKey, { kind: "ordering" }>).correctOrder;
            expect(order).toHaveLength(items.length);
            expect(new Set(order).size).toBe(items.length);
          }

          // conventions_stated verbatim, when declared (static or per-instance override).
          const declared = generated.conventionsStated ?? template.conventionsStated;
          if (declared !== "n/a") {
            const strings: string[] = [];
            (function collect(v: unknown) {
              if (typeof v === "string") strings.push(v);
              else if (Array.isArray(v)) v.forEach(collect);
              else if (v && typeof v === "object") Object.values(v).forEach(collect);
            })(content);
            expect(strings.join(" "), `${template.id} conventions_stated`).toContain(declared);
          }
        }
      }
    });
  }
});

describe("every investigation scenario: correctness roundtrip across causes/difficulties/seeds", () => {
  const SEED_COUNT = 15;
  const DIFFICULTIES: Difficulty[] = [1, 2, 3];

  for (const scenario of INVESTIGATION_SCENARIOS) {
    it(`${scenario.id} — generates a scoreable, well-formed scene for every cause and difficulty`, () => {
      for (const cause of scenario.causeVariants) {
        for (const difficulty of DIFFICULTIES) {
          for (let i = 0; i < SEED_COUNT; i++) {
            const seed = deriveItemSeed(BigInt(i) * 61n + 7n, `${scenario.id}.${cause}`, i);
            const rng = createRng(seed);
            const { content, answerKey } = scenario.generate(rng, cause, difficulty);
            const key = answerKey as InvestigationAnswerKey;

            const result = scoreItem("investigation", correctAnswerFor("investigation", key), key);
            expect(result.sI, `${scenario.id} ${cause} d${difficulty} seed${i}`).toBe(1);

            const tabKeys = new Set(content.tabs.map((t) => t.key));
            expect(tabKeys.has(key.decisiveArtifactKeyQ1)).toBe(true);
            expect(tabKeys.has(key.decisiveArtifactKeyQ3)).toBe(true);
            expect(content.tabs.some((t) => t.decoy)).toBe(true);
            expect(new Set(content.q1.options).size).toBe(content.q1.options.length);
            expect(new Set(content.q2.options).size).toBe(content.q2.options.length);

            const q3Tab = content.tabs.find((t) => t.key === key.decisiveArtifactKeyQ3);
            expect(q3Tab?.body.includes(key.q3CorrectText)).toBe(true);

            // Escalation correctness matches the scenario's declaration for this cause.
            expect(key.q2IsEscalation).toBe(scenario.escalationCauses.includes(cause));
          }
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Snapshot test (TEST_STRATEGY.md §3: "snapshot of 50 seeds' content" — a
// fixed sample across all four pillars, so an accidental template edit shows
// up as a visible diff in review).
// ---------------------------------------------------------------------------
describe("bank content snapshot (guards against accidental template drift)", () => {
  it("freezes rendered content for a fixed sample of templates x seeds x difficulties", () => {
    const sample: unknown[] = [];
    let seedCounter = 1;

    for (const template of ALL_CHOICE_TEMPLATES) {
      const difficulty = template.difficulties[0] as Difficulty;
      const seed = deriveItemSeed(BigInt(seedCounter), template.id, seedCounter);
      seedCounter++;
      const rng = createRng(seed);
      const { content } = template.generate(rng, difficulty);
      sample.push({ id: template.id, difficulty, content });
    }

    for (const scenario of INVESTIGATION_SCENARIOS) {
      const cause = scenario.causeVariants[0];
      const seed = deriveItemSeed(BigInt(seedCounter), `${scenario.id}.${cause}`, seedCounter);
      seedCounter++;
      const rng = createRng(seed);
      const { content } = scenario.generate(rng, cause, 1);
      sample.push({ id: scenario.id, cause, content });
    }

    expect(sample).toMatchSnapshot();
  });
});
