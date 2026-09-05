// speed.count_matches — ASSESSMENT_DESIGN.md §3.1 worked example 1.
// 8-line log; how many lines are ERROR/WARN for a specific service?
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { SERVICE_POOL, generateDistinctDistractors, pad2, shuffleOptions } from "../helpers";

const LEVELS = ["INFO", "WARN", "ERROR"] as const;
const ACTIONS: Record<string, string[]> = {
  billing: ["charge failed", "charge ok", "retry scheduled", "webhook timeout", "refund issued"],
  auth: ["login ok", "token expired", "rate limit", "login failed", "session revoked"],
  sync: ["batch ok", "batch failed", "queue full", "retry scheduled"],
  webhooks: ["delivered", "signature invalid", "timeout", "retry scheduled"],
  reports: ["generated", "generation failed", "empty result"],
  export: ["export ok", "export failed", "quota exceeded"],
  search: ["query ok", "query timeout", "index stale"],
  notifications: ["sent", "send failed", "rate limit"],
};

export const template: ItemTemplate = {
  id: "speed.count_matches",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const services = rng.sample(SERVICE_POOL, 3);
    const targetService = rng.pick(services);
    const targetLevel = rng.pick(LEVELS as unknown as string[]);

    let h = 12,
      m = 0,
      s = 0;
    const lines: string[] = [];
    let matchCount = 0;
    const lineCount = 8;
    for (let i = 0; i < lineCount; i++) {
      s += rng.nextIntBetween(1, 5);
      if (s >= 60) {
        s -= 60;
        m += 1;
        if (m >= 60) {
          m -= 60;
          h += 1;
        }
      }
      const service = rng.pick(services);
      // Bias level generation so we get a plausible non-trivial count (2-4) for the target combo.
      const level = rng.pick(LEVELS as unknown as string[]);
      const action = rng.pick(ACTIONS[service] ?? ["ok"]);
      const orderId = rng.nextIntBetween(88000, 88999);
      lines.push(
        `${pad2(h)}:${pad2(m)}:${pad2(s)} ${level.padEnd(5)} ${service.padEnd(8)} ${action} order=${orderId}`,
      );
      if (service === targetService && level === targetLevel) matchCount++;
    }

    const log = lines.join("\n");
    const prompt = `בכמה מהשורות הבאות מופיע \`${targetLevel}\` של השירות \`${targetService}\`?\n\n\`\`\`\n${log}\n\`\`\``;

    const distractors = generateDistinctDistractors(
      3,
      [String(matchCount)],
      () => String(Math.max(0, matchCount + rng.pick([-3, -2, -1, 1, 2, 3, 4, 5]))),
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, String(matchCount), distractors);

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
