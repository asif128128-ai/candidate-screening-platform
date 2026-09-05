import { describe, expect, it } from "vitest";
import { ALL_CHOICE_TEMPLATES, INVESTIGATION_SCENARIOS, REASONING_TEMPLATES, SPEED_TEMPLATES, TECH_TEMPLATES } from "@/assessment/bank";
import { RELATIONS } from "@/assessment/bank/reasoning/analogy_structural";
import { createRng, deriveItemSeed } from "@/assessment/rng";
import { scoreItem, type CandidateAnswer } from "@/assessment/scoring";
import type { AnswerKey, Difficulty, InvestigationAnswerKey, ItemTemplate } from "@/assessment/types";

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
// Red-team finding #1 — most tech and several reasoning templates silently
// ignored the `difficulty` parameter and generated materially identical
// content at every declared level, even though scoring.ts's
// DIFFICULTY_WEIGHT gives d3 items 1.7x weight and integrity.ts's
// "impossible timing" check specifically singles out d3 items. Each
// assertion below is a real, measurable proxy for "this difficulty level
// is genuinely harder than the one below it" for the specific template —
// not just "it still produces a scoreable item" (that's already covered by
// the roundtrip test above).
// ---------------------------------------------------------------------------
describe("fixed templates: content genuinely scales with declared difficulty (red-team finding #1)", () => {
  function tpl(id: string): ItemTemplate {
    const t = ALL_CHOICE_TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error(`template not found: ${id}`);
    return t;
  }

  function genAt(id: string, difficulty: Difficulty, seedIdx = 0): { prompt: string; options: string[] } {
    const t = tpl(id);
    const seed = deriveItemSeed(BigInt(seedIdx) * 97n + 13n, id, seedIdx);
    const { content } = t.generate(createRng(seed), difficulty);
    return content as { prompt: string; options: string[] };
  }

  /** Counts markdown table data rows (total "|"-lines minus the header and separator lines). */
  function markdownDataRowCount(text: string): number {
    const pipeLines = text.split("\n").filter((l) => l.trim().startsWith("|"));
    const dataLines = pipeLines.filter((l) => !l.includes("---"));
    return Math.max(0, dataLines.length - 1); // minus the header line
  }

  const SEEDS = Array.from({ length: 12 }, (_, i) => i);

  it("tech.cloud_waste: more resource rows, and a subtler decoy, as difficulty rises", () => {
    for (const s of SEEDS) {
      const d1Rows = markdownDataRowCount(genAt("tech.cloud_waste", 1, s).prompt);
      const d2Rows = markdownDataRowCount(genAt("tech.cloud_waste", 2, s).prompt);
      const d3Rows = markdownDataRowCount(genAt("tech.cloud_waste", 3, s).prompt);
      expect(d1Rows).toBe(3);
      expect(d2Rows).toBe(4);
      expect(d3Rows).toBe(5);
    }
    // d3 introduces a periodic-workload decoy that a naive "lowest usage %"
    // heuristic would wrongly flag.
    expect(genAt("tech.cloud_waste", 3, 0).prompt).toContain("batch-runner");
  });

  it("tech.minimal_access: bigger, and eventually non-ladder, permission matrix as difficulty rises", () => {
    for (const s of SEEDS) {
      const d1Rows = markdownDataRowCount(genAt("tech.minimal_access", 1, s).prompt);
      const d2Rows = markdownDataRowCount(genAt("tech.minimal_access", 2, s).prompt);
      const d3Rows = markdownDataRowCount(genAt("tech.minimal_access", 3, s).prompt);
      expect(d1Rows).toBe(3);
      expect(d2Rows).toBe(4);
      expect(d3Rows).toBe(5);
    }
    // d3's matrix has a genuine exception to the cumulative-ladder pattern
    // (auditor), which is the whole point of the harder tier.
    expect(genAt("tech.minimal_access", 3, 0).prompt).toContain("מבקר (auditor)");
  });

  it("tech.http_status_next: the status-code pool is disjoint and escalates from common to obscure codes", () => {
    const codeOf = (prompt: string): number => Number(/HTTP\/1\.1 (\d+)/.exec(prompt)?.[1]);
    const easy = new Set([429, 401]);
    const moderate = new Set([503, 400]);
    const hard = new Set([202, 409]);
    for (const s of SEEDS) {
      expect(easy.has(codeOf(genAt("tech.http_status_next", 1, s).prompt))).toBe(true);
      expect(moderate.has(codeOf(genAt("tech.http_status_next", 2, s).prompt))).toBe(true);
      expect(hard.has(codeOf(genAt("tech.http_status_next", 3, s).prompt))).toBe(true);
    }
  });

  it("tech.env_diff_bug: more harmless decoy vars, and a less-hinting error message, as difficulty rises", () => {
    const countAssignments = (prompt: string): number => (prompt.match(/^[A-Z_]+=/gm) ?? []).length;
    for (const s of SEEDS) {
      expect(countAssignments(genAt("tech.env_diff_bug", 1, s).prompt)).toBe(2); // 1 var x 2 environments
      expect(countAssignments(genAt("tech.env_diff_bug", 2, s).prompt)).toBe(4); // 2 vars x 2
      expect(countAssignments(genAt("tech.env_diff_bug", 3, s).prompt)).toBe(6); // 3 vars x 2
    }
  });

  it("tech.git_what_happened: d3 stories are strictly more complex mechanisms than the d2 story", () => {
    for (const s of SEEDS) {
      expect(genAt("tech.git_what_happened", 2, s).prompt).toContain("מחקה בטעות את branch");
      const hardPrompt = genAt("tech.git_what_happened", 3, s).prompt;
      expect(hardPrompt.includes("force-push") || hardPrompt.includes("rebase -i")).toBe(true);
      expect(hardPrompt).not.toContain("מחקה בטעות את branch");
    }
  });

  it("tech.automation_pick: d1/d2 task pools are disjoint, and d2 tasks require resisting a tempting-but-wrong instinct", () => {
    const d1Tasks = new Set(SEEDS.map((s) => genAt("tech.automation_pick", 1, s).prompt));
    const d2Tasks = new Set(SEEDS.map((s) => genAt("tech.automation_pick", 2, s).prompt));
    for (const t of d1Tasks) expect(d2Tasks.has(t)).toBe(false);
    expect(d2Tasks.size).toBeGreaterThan(0);
  });

  it("tech.data_normalize: d1 is a single-rule case (phone/email); d2 requires juggling more than one rule at once (dates/names)", () => {
    for (const s of SEEDS) {
      const d1Title = genAt("tech.data_normalize", 1, s).prompt;
      const d2Title = genAt("tech.data_normalize", 2, s).prompt;
      expect(d1Title.includes("טור מספרי טלפון") || d1Title.includes("טור כתובות אימייל")).toBe(true);
      expect(d2Title.includes("טור תאריכים") || d2Title.includes('טור שמות')).toBe(true);
    }
  });

  it("tech.field_mapping_error: d2 rows use near-duplicate (confusable) targets instead of semantically distant ones", () => {
    for (const s of SEEDS) {
      const easy = genAt("tech.field_mapping_error", 1, s).prompt;
      const hard = genAt("tech.field_mapping_error", 2, s).prompt;
      expect(markdownDataRowCount(easy)).toBe(4);
      expect(markdownDataRowCount(hard)).toBe(5);
      // Hard rows are drawn from confusable pairs (Billing/Shipping or
      // Start/End) that never appear in the easy pool.
      expect(/Billing|Shipping|StartDate|EndDate/.test(hard)).toBe(true);
      expect(/Billing|Shipping|StartDate|EndDate/.test(easy)).toBe(false);
    }
  });

  it("tech.security_smell: d2's dangerous practice is a subtler smell, always shown alongside a same-surface-feature decoy that's actually safe", () => {
    function correctTextAt(difficulty: Difficulty, seedIdx: number): string {
      const t = tpl("tech.security_smell");
      const seed = deriveItemSeed(BigInt(seedIdx) * 97n + 13n, t.id, seedIdx);
      const { content, answerKey } = t.generate(createRng(seed), difficulty) as {
        content: { options: string[] };
        answerKey: Extract<AnswerKey, { kind: "single_choice" }>;
      };
      return content.options[answerKey.correctIndex] as string;
    }
    const easyDangerousTexts = new Set(SEEDS.map((s) => correctTextAt(1, s)));
    const hardDangerousTexts = new Set(SEEDS.map((s) => correctTextAt(2, s)));
    for (const t of hardDangerousTexts) expect(easyDangerousTexts.has(t)).toBe(false);

    // Across the pool, at least one d2 decoy shares a surface feature
    // (public / shared) with a d1 "always dangerous" pattern while actually
    // being safe — proving the shortcut "public/shared = automatically
    // dangerous" no longer works on its own.
    const anyHardOptionsMatch = SEEDS.some((s) =>
      /ציבורי|שירות \(service account\) יחיד/.test(genAt("tech.security_smell", 2, s).options.join(" ")),
    );
    expect(anyHardOptionsMatch).toBe(true);
  });

  it("tech.site_down_first_check: d1/d2 symptom pools are disjoint, and d2 requires isolating which subsystem actually failed", () => {
    const d1 = new Set(SEEDS.map((s) => genAt("tech.site_down_first_check", 1, s).prompt));
    const d2 = new Set(SEEDS.map((s) => genAt("tech.site_down_first_check", 2, s).prompt));
    for (const p of d1) expect(d2.has(p)).toBe(false);
  });

  it("tech.webhook_vs_polling: d2 includes a genuine tradeoff case (unreliable webhook -> needs a polling safety net too)", () => {
    const d2Prompts = SEEDS.map((s) => genAt("tech.webhook_vs_polling", 2, s).prompt);
    expect(d2Prompts.some((p) => p.includes("נופלים"))).toBe(true);
    const d1Prompts = new Set(SEEDS.map((s) => genAt("tech.webhook_vs_polling", 1, s).prompt));
    for (const p of d2Prompts) expect(d1Prompts.has(p)).toBe(false);
  });

  it("reasoning.analogy_structural: distractors increasingly share the target's relation family as difficulty rises", () => {
    function sameFamilyFraction(difficulty: Difficulty): number {
      let sameFamilyCount = 0;
      let totalDistractors = 0;
      for (const s of SEEDS) {
        const t = tpl("reasoning.analogy_structural");
        const seed = deriveItemSeed(BigInt(s) * 97n + 13n, t.id, s);
        const rng = createRng(seed);
        const { content, answerKey } = t.generate(rng, difficulty) as {
          content: { options: string[] };
          answerKey: Extract<AnswerKey, { kind: "single_choice" }>;
        };
        const correctText = content.options[answerKey.correctIndex];
        const relation = RELATIONS.find((r) => r.pairs.some((p) => p[1] === correctText));
        const familyBs = new Set(relation?.pairs.map((p) => p[1]) ?? []);
        content.options.forEach((opt, i) => {
          if (i === answerKey.correctIndex) return;
          totalDistractors++;
          if (familyBs.has(opt)) sameFamilyCount++;
        });
      }
      return totalDistractors > 0 ? sameFamilyCount / totalDistractors : 0;
    }

    const d1Fraction = sameFamilyFraction(1);
    const d2Fraction = sameFamilyFraction(2);
    const d3Fraction = sameFamilyFraction(3);
    expect(d1Fraction).toBe(0); // d1: never a same-family distractor
    expect(d2Fraction).toBeGreaterThan(d1Fraction);
    expect(d2Fraction).toBeLessThan(1);
    expect(d3Fraction).toBe(1); // d3: every distractor is same-family
  });

  it("reasoning.grid_pattern: more distractor options as difficulty rises (2 fewer rules at d1, an extra double-violation decoy at d3)", () => {
    for (const s of SEEDS) {
      expect(genAt("reasoning.grid_pattern", 1, s).options).toHaveLength(4);
      expect(genAt("reasoning.grid_pattern", 2, s).options).toHaveLength(6);
      expect(genAt("reasoning.grid_pattern", 3, s).options).toHaveLength(7);
    }
    // d3 no longer states the rules in prose — they must be induced from the grid.
    expect(genAt("reasoning.grid_pattern", 3, 0).prompt).not.toContain("כל שורה משתמשת בצורה קבועה");
    expect(genAt("reasoning.grid_pattern", 1, 0).prompt).toContain("כל שורה משתמשת בצורה קבועה");
  });

  it("reasoning.grid_pattern: every generated item has a real SVG figure and SVG-tile options (FINTECH_REDESIGN_PLAN.md §4 A1)", () => {
    const t = tpl("reasoning.grid_pattern");
    for (const difficulty of t.difficulties) {
      for (const s of SEEDS) {
        const seed = deriveItemSeed(BigInt(s) * 97n + 13n, t.id, s);
        const { content } = t.generate(createRng(seed), difficulty) as {
          content: { options: string[]; figureSvg?: string; optionsFormat?: string };
        };
        expect(content.figureSvg?.startsWith("<svg")).toBe(true);
        expect(content.optionsFormat).toBe("svg");
        for (const opt of content.options) {
          expect(opt.startsWith("<svg")).toBe(true);
        }
      }
    }
  });

  it("reasoning.table_must_be_true: more rows to scan as difficulty rises (5 -> 6 -> 9)", () => {
    for (const s of SEEDS) {
      expect(markdownDataRowCount(genAt("reasoning.table_must_be_true", 1, s).prompt)).toBe(5);
      expect(markdownDataRowCount(genAt("reasoning.table_must_be_true", 2, s).prompt)).toBe(6);
      expect(markdownDataRowCount(genAt("reasoning.table_must_be_true", 3, s).prompt)).toBe(9);
    }
  });
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
