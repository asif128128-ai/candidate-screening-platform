// speed.log_gap — "איפה המערכת נעצרה". A short timestamped log with one
// conspicuous pause; between which two consecutive lines is the largest gap?
// conventions_stated: n/a — reading clock times needs no prior exposure.
//
// Added in the Round 3 anti-externalization pass (ASSESSMENT_DESIGN.md §2.2,
// §3.1). On-target because "the system was doing nothing for two minutes
// here" is a first-order operational instinct, and it is not measured
// anywhere else in the bank (count_matches scans for a value; this scans for
// a *rhythm*). Photo-resistant relative to its 15 s limit for the same reason
// smell_the_number is: a person who reads logs sees the hole immediately,
// while a model has to difference every adjacent pair before it can answer.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { SERVICE_POOL, pad2, shuffleOptions } from "../helpers";

const ACTIONS = [
  "batch ok",
  "queue drained",
  "heartbeat",
  "sync ok",
  "cache warmed",
  "job started",
  "job finished",
  "checkpoint saved",
];

/** The gap that separates the pause from ordinary line-to-line jitter. */
const NORMAL_GAP_MAX_S = 9;
const PAUSE_GAP_MIN_S = 45;

export const template: ItemTemplate = {
  id: "speed.log_gap",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const lineCount = 6;
    const service = rng.pick(SERVICE_POOL);

    // One pause somewhere in the middle; every other step is small jitter, so
    // the largest gap is unique and unambiguous by construction.
    const pauseAfter = rng.nextIntBetween(1, lineCount - 2);
    const gaps: number[] = [];
    for (let i = 0; i < lineCount - 1; i++) {
      gaps.push(i === pauseAfter ? rng.nextIntBetween(PAUSE_GAP_MIN_S, 240) : rng.nextIntBetween(1, NORMAL_GAP_MAX_S));
    }

    let t = rng.nextIntBetween(9, 21) * 3600 + rng.nextIntBetween(0, 59) * 60 + rng.nextIntBetween(0, 59);
    const stamps: string[] = [];
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
      if (i > 0) t += gaps[i - 1] as number;
      const stamp = `${pad2(Math.floor(t / 3600) % 24)}:${pad2(Math.floor(t / 60) % 60)}:${pad2(t % 60)}`;
      stamps.push(stamp);
      lines.push(`${stamp} ${service.padEnd(8)} ${rng.pick(ACTIONS)}`);
    }

    const label = (i: number) => `בין ${stamps[i]} ל-${stamps[i + 1]}`;
    const correct = label(pauseAfter);
    // Distractors are other real adjacent pairs from the same log, so the
    // candidate cannot eliminate anything by format — only by reading the
    // clock.
    const others = Array.from({ length: lineCount - 1 }, (_, i) => i).filter((i) => i !== pauseAfter);
    const distractors = rng.sample(others, 3).map(label);

    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);

    const prompt =
      `בין אילו שתי שורות עברה הכי הרבה זמן?\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``;

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
