import { describe, expect, it } from "vitest";
import { generateSession, type Blueprint } from "@/assessment/generator";
import { scoreItem, type CandidateAnswer } from "@/assessment/scoring";
import type { AnswerKey, GeneratedItem } from "@/assessment/types";

// The seed blueprint (supabase/migrations/0002_seed.sql, DATA_MODEL.md §3.3,
// as amended by DECISIONS_LOG.md #4/#9): 27 items, weights 0.30/0.30/0.25/0.15.
const BLUEPRINT: Blueprint = {
  version: 1,
  blocks: [
    { key: "speed", pillar: "speed", count: 10, time_limit_s: 20, pool: "speed.*" },
    { key: "reasoning", pillar: "reasoning", count: 6, time_limit_s: 75, pool: "reasoning.*" },
    { key: "tech", pillar: "tech", count: 7, time_limit_s: 60, pool: "tech.*" },
    { key: "investigate", pillar: "independence", count: 4, time_limit_s: 180, pool: "investigate.*" },
  ],
  weights: { reasoning: 0.3, independence: 0.3, tech: 0.25, speed: 0.15 },
  session_wall_clock_min: 75,
};

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

const SEEDS = Array.from({ length: 1000 }, (_, i) => BigInt(i) * 6364136223846793005n + 1442695040888963407n);

describe("generateSession — structural invariants over 1,000 seeds", () => {
  it("always produces exactly 27 items, numbered 1..27 in block order", () => {
    for (const seed of SEEDS) {
      const items = generateSession(BLUEPRINT, seed);
      expect(items).toHaveLength(27);
      expect(items.map((i) => i.position)).toEqual(Array.from({ length: 27 }, (_, k) => k + 1));
      expect(items.slice(0, 10).every((i) => i.blockKey === "speed")).toBe(true);
      expect(items.slice(10, 16).every((i) => i.blockKey === "reasoning")).toBe(true);
      expect(items.slice(16, 23).every((i) => i.blockKey === "tech")).toBe(true);
      expect(items.slice(23, 27).every((i) => i.blockKey === "investigate")).toBe(true);
    }
  });

  it("never repeats a template family within a session, per block", () => {
    for (const seed of SEEDS) {
      const items = generateSession(BLUEPRINT, seed);
      const byBlock = new Map<string, string[]>();
      for (const item of items) {
        const list = byBlock.get(item.blockKey) ?? [];
        list.push(item.templateId);
        byBlock.set(item.blockKey, list);
      }
      for (const ids of byBlock.values()) {
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("matches the blueprint's difficulty mix exactly, per block", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const items = generateSession(BLUEPRINT, seed);
      const reasoning = items.filter((i) => i.blockKey === "reasoning").map((i) => i.difficulty).sort();
      expect(reasoning).toEqual([1, 1, 2, 2, 2, 3]);
      const tech = items.filter((i) => i.blockKey === "tech").map((i) => i.difficulty).sort();
      expect(tech).toEqual([1, 1, 2, 2, 2, 2, 3]);
      const investigate = items.filter((i) => i.blockKey === "investigate").map((i) => i.difficulty).sort();
      expect(investigate).toEqual([1, 2, 2, 3]);
      const speed = items.filter((i) => i.blockKey === "speed").map((i) => i.difficulty);
      expect(speed.every((d) => d === 1)).toBe(true);
    }
  });

  it("is fully deterministic: the same seed always regenerates the same session (refresh/reconnect safety)", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const a = generateSession(BLUEPRINT, seed);
      const b = generateSession(BLUEPRINT, seed);
      expect(a).toEqual(b);
    }
  });

  it("every generated item's declared correct answer scores exactly 1 (ASSESSMENT_DESIGN.md §4.4)", () => {
    for (const seed of SEEDS) {
      const items = generateSession(BLUEPRINT, seed);
      for (const item of items) {
        const result = scoreItem(item.kind, correctAnswerFor(item), item.answerKey);
        expect(result.sI, `${item.templateId}@${item.position} (seed ${seed})`).toBe(1);
      }
    }
  });

  it("every single_choice distractor scores 0", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const items = generateSession(BLUEPRINT, seed);
      for (const item of items) {
        if (item.kind !== "single_choice") continue;
        const key = item.answerKey as Extract<AnswerKey, { kind: "single_choice" }>;
        const options = (item.content as { options: string[] }).options;
        for (let idx = 0; idx < options.length; idx++) {
          if (idx === key.correctIndex) continue;
          expect(scoreItem("single_choice", { selectedIndex: idx }, item.answerKey).sI).toBe(0);
        }
      }
    }
  });

  it("no two options within a single_choice/investigation item are textually identical", () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const items = generateSession(BLUEPRINT, seed);
      for (const item of items) {
        const content = item.content as unknown as Record<string, unknown>;
        if (Array.isArray(content.options)) {
          expect(new Set(content.options).size, item.templateId).toBe((content.options as string[]).length);
        }
        if (item.kind === "investigation") {
          const inv = content as { q1: { options: string[] }; q2: { options: string[] } };
          expect(new Set(inv.q1.options).size).toBe(inv.q1.options.length);
          expect(new Set(inv.q2.options).size).toBe(inv.q2.options.length);
        }
      }
    }
  });

  it("declared conventions_stated text appears verbatim in the rendered content when not n/a", () => {
    function collectStrings(value: unknown, out: string[]): void {
      if (typeof value === "string") out.push(value);
      else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
      else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, out);
    }
    for (const seed of SEEDS.slice(0, 200)) {
      const items = generateSession(BLUEPRINT, seed);
      for (const item of items) {
        if (item.conventionsStated === "n/a") continue;
        const strings: string[] = [];
        collectStrings(item.content, strings);
        expect(strings.join(" "), `${item.templateId}@${item.position}`).toContain(item.conventionsStated);
      }
    }
  });

  it("investigation scenes always declare a decisive artifact that exists among the tabs", () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const items = generateSession(BLUEPRINT, seed);
      for (const item of items.filter((i) => i.kind === "investigation")) {
        const key = item.answerKey as Extract<AnswerKey, { kind: "investigation" }>;
        const content = item.content as { tabs: Array<{ key: string; decoy?: boolean }> };
        const tabKeys = new Set(content.tabs.map((t) => t.key));
        expect(tabKeys.has(key.decisiveArtifactKeyQ1)).toBe(true);
        expect(tabKeys.has(key.decisiveArtifactKeyQ3)).toBe(true);
        expect(content.tabs.some((t) => t.decoy)).toBe(true);
      }
    }
  });

  it("session-level escalation invariants hold in every session (DECISIONS_LOG.md #6)", () => {
    for (const seed of SEEDS) {
      const items = generateSession(BLUEPRINT, seed);
      const invItems = items.filter((i) => i.blockKey === "investigate");
      const keys = invItems.map((i) => i.answerKey as Extract<AnswerKey, { kind: "investigation" }>);
      expect(keys.some((k) => k.q2IsEscalation)).toBe(true);
      expect(keys.some((k) => k.q2HasNoEvidenceEscalationDistractor)).toBe(true);
    }
  });

  it("speed.bool_logic and other maxOncePerSession families never appear twice (structurally guaranteed by no-repeat selection)", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const items = generateSession(BLUEPRINT, seed);
      const boolLogicCount = items.filter((i) => i.templateId === "speed.bool_logic").length;
      expect(boolLogicCount).toBeLessThanOrEqual(1);
    }
  });
});

describe("generateSession — cohort balancing hook (ASSESSMENT_DESIGN.md §3.3.1)", () => {
  it("prefers less-used scenarios when scenarioUsageCounts is provided", () => {
    // Heavily penalize every scenario except one; the generator should
    // consistently prefer the untouched one when it can.
    const usage: Record<string, number> = {
      "investigate.webhook_missing": 1000,
      "investigate.sso_login_subset": 1000,
      "investigate.nightly_report_empty": 1000,
      "investigate.cloud_bill_spike": 1000,
      "investigate.export_permission": 1000,
      "investigate.sync_rate_limited": 1000,
      "investigate.duplicate_submissions": 1000,
      "investigate.email_undelivered": 1000,
      "investigate.cert_expired_subdomain": 1000,
      "investigate.backup_silently_failing": 1000,
      "investigate.saas_seat_limit": 1000,
      // investigate.import_garbled_names left untouched (usage 0)
    };
    let sawUntouched = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      const items = generateSession(BLUEPRINT, seed, { scenarioUsageCounts: usage });
      const ids = items.filter((i) => i.blockKey === "investigate").map((i) => i.templateId);
      if (ids.includes("investigate.import_garbled_names")) sawUntouched++;
    }
    // With 1 untouched scenario out of 12 and 4 slots per session, it should
    // be picked in the vast majority of sessions (heavily preferred by the
    // least-used-first selection).
    expect(sawUntouched).toBeGreaterThan(90);
  });
});
