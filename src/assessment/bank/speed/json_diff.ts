// speed.json_diff — ASSESSMENT_DESIGN.md §3.1. Two 5-key JSON objects,
// nearly identical; which key's value differs? conventions_stated: n/a
// (derivable purely from the two artifacts).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface KeyDef {
  name: string;
  gen: (rng: Rng) => string | number | boolean;
  distinctFrom: (rng: Rng, prev: string | number | boolean) => string | number | boolean;
}

const CITY_POOL = ["חיפה", "אשדוד", "רמת גן", "נתניה", "חולון", "רעננה"];
const STATUS_POOL = ["active", "pending", "closed", "archived"];

const KEY_POOL: KeyDef[] = [
  {
    name: "id",
    gen: (r) => r.nextIntBetween(1000, 9999),
    distinctFrom: (r, prev) => {
      let v = r.nextIntBetween(1000, 9999);
      while (v === prev) v = r.nextIntBetween(1000, 9999);
      return v;
    },
  },
  {
    name: "status",
    gen: (r) => r.pick(STATUS_POOL),
    distinctFrom: (r, prev) => {
      let v = r.pick(STATUS_POOL);
      while (v === prev) v = r.pick(STATUS_POOL);
      return v;
    },
  },
  {
    name: "amount",
    gen: (r) => r.nextIntBetween(10, 999),
    distinctFrom: (r, prev) => {
      let v = r.nextIntBetween(10, 999);
      while (v === prev) v = r.nextIntBetween(10, 999);
      return v;
    },
  },
  {
    name: "region",
    gen: (r) => r.pick(CITY_POOL),
    distinctFrom: (r, prev) => {
      let v = r.pick(CITY_POOL);
      while (v === prev) v = r.pick(CITY_POOL);
      return v;
    },
  },
  {
    name: "retries",
    gen: (r) => r.nextIntBetween(0, 5),
    distinctFrom: (r, prev) => {
      let v = r.nextIntBetween(0, 5);
      while (v === prev) v = r.nextIntBetween(0, 5);
      return v;
    },
  },
  {
    name: "active",
    gen: (r) => r.chance(),
    distinctFrom: (_r, prev) => !prev,
  },
  {
    name: "priority",
    gen: (r) => r.nextIntBetween(1, 3),
    distinctFrom: (r, prev) => {
      let v = r.nextIntBetween(1, 3);
      while (v === prev) v = r.nextIntBetween(1, 3);
      return v;
    },
  },
];

function renderJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

export const template: ItemTemplate = {
  id: "speed.json_diff",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const keys = rng.sample(KEY_POOL, 5);
    const objA: Record<string, unknown> = {};
    for (const k of keys) objA[k.name] = k.gen(rng);
    const objB: Record<string, unknown> = { ...objA };
    const diffKeyIdx = rng.nextInt(keys.length);
    const diffKey = keys[diffKeyIdx] as KeyDef;
    objB[diffKey.name] = diffKey.distinctFrom(rng, objA[diffKey.name] as never);

    const prompt =
      "להלן שני אובייקטי JSON כמעט זהים. באיזה מפתח (key) הערך שונה בין השניים?\n\n" +
      "אובייקט A:\n```\n" +
      renderJson(objA) +
      "\n```\n\nאובייקט B:\n```\n" +
      renderJson(objB) +
      "\n```";

    const distractors = keys.filter((_, i) => i !== diffKeyIdx).map((k) => k.name);
    const { options, correctIndex } = shuffleOptions(rng, diffKey.name, distractors);

    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
