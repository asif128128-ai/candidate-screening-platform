// speed.ip_valid — ASSESSMENT_DESIGN.md §3.1. The rule is stated in the
// item itself (DECISIONS_LOG.md #8 "the convention is in the item"), so
// this tests careful reading, not prior networking exposure.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

function validIp(rng: Rng): string {
  return [0, 0, 0, 0].map(() => rng.nextIntBetween(0, 255)).join(".");
}

type Breaker = (rng: Rng) => string;

const BREAKERS: Breaker[] = [
  // one octet out of range
  (rng) => {
    const octets = [0, 0, 0, 0].map(() => rng.nextIntBetween(0, 255));
    const idx = rng.nextInt(4);
    octets[idx] = rng.nextIntBetween(256, 999);
    return octets.join(".");
  },
  // wrong number of parts
  (rng) => {
    const n = rng.chance() ? 3 : 5;
    return Array.from({ length: n }, () => rng.nextIntBetween(0, 255)).join(".");
  },
  // non-numeric octet
  (rng) => {
    const octets: (string | number)[] = [0, 0, 0, 0].map(() => rng.nextIntBetween(0, 255));
    const idx = rng.nextInt(4);
    octets[idx] = rng.pick(["ab", "x1", "1a", "--"]);
    return octets.join(".");
  },
  // negative-looking / empty octet
  (rng) => {
    const octets: (string | number)[] = [0, 0, 0, 0].map(() => rng.nextIntBetween(0, 255));
    const idx = rng.nextInt(4);
    octets[idx] = "";
    return octets.join(".");
  },
];

export const template: ItemTemplate = {
  id: "speed.ip_valid",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "כתובת IPv4 תקינה היא ארבעה מספרים בטווח 0–255, מופרדים בנקודות",
  fluency: true,
  generate(rng: Rng) {
    const good = validIp(rng);
    const chosenBreakers = rng.sample(BREAKERS, 3);
    const bad = chosenBreakers.map((b) => b(rng));

    const prompt =
      "כתובת IPv4 תקינה היא ארבעה מספרים בטווח 0–255, מופרדים בנקודות (למשל 192.168.1.1).\n" +
      "איזו מהכתובות הבאות תקינה?";
    // Note: conventionsStated (above) is a substring of the sentence embedded
    // in the prompt above — kept without the trailing period so it matches
    // verbatim regardless of what follows it in the sentence.
    const { options, correctIndex } = shuffleOptions(rng, good, bad);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
