// speed.smell_the_number — "המספר שלא מסתדר". Four one-line dashboard
// metrics; exactly one is internally impossible. conventions_stated: n/a —
// every impossibility is arithmetic that the line itself states.
//
// Added in the Round 3 anti-externalization pass (ASSESSMENT_DESIGN.md §2.2,
// §3.1): numeric sanity — "that figure can't be right" — is the single most
// common real technology-instinct moment, and it was not measured anywhere in
// the bank. It is also one of the few shapes that is genuinely faster for a
// person than for a phone-camera LLM loop: a candidate who has the instinct
// sees the bad line at a glance, while a model has to actually check four
// independent claims before it can answer.
//
// Every option is self-contained — the impossibility never depends on
// comparing two different options — so "which one" is never ambiguous and the
// audit's single-correct-answer invariant holds by construction.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { generateDistinctDistractors, shuffleOptions } from "../helpers";

/**
 * A metric shape that can render either a consistent line or an impossible
 * one. `kind` is used only to keep the four rendered lines shape-distinct.
 */
interface MetricShape {
  kind: string;
  ok: (rng: Rng) => string;
  bad: (rng: Rng) => string;
}

const SHAPES: MetricShape[] = [
  {
    kind: "success_of_total",
    ok: (r) => {
      const total = r.nextIntBetween(400, 9000);
      const ok = r.nextIntBetween(Math.floor(total * 0.5), total);
      return `בקשות שהצליחו: ${ok} מתוך ${total}`;
    },
    // Impossible: more successes than attempts.
    bad: (r) => {
      const total = r.nextIntBetween(400, 9000);
      const ok = total + r.nextIntBetween(15, 400);
      return `בקשות שהצליחו: ${ok} מתוך ${total}`;
    },
  },
  {
    kind: "percent",
    ok: (r) => `שיעור השלמה: ${r.nextIntBetween(41, 99)}%`,
    // Impossible: a share of a whole above 100%.
    bad: (r) => `שיעור השלמה: ${r.nextIntBetween(104, 180)}%`,
  },
  {
    kind: "avg_vs_max",
    ok: (r) => {
      const max = r.nextIntBetween(600, 4000);
      const avg = r.nextIntBetween(80, max - 40);
      return `זמן תגובה: ממוצע ${avg} ms, מקסימום ${max} ms`;
    },
    // Impossible: an average above the maximum it is averaged over.
    bad: (r) => {
      const max = r.nextIntBetween(300, 1500);
      const avg = max + r.nextIntBetween(120, 900);
      return `זמן תגובה: ממוצע ${avg} ms, מקסימום ${max} ms`;
    },
  },
  {
    kind: "active_of_registered",
    ok: (r) => {
      const total = r.nextIntBetween(900, 12000);
      const active = r.nextIntBetween(50, Math.floor(total * 0.8));
      return `משתמשים פעילים היום: ${active}, רשומים במערכת: ${total}`;
    },
    // Impossible: more active users today than exist.
    bad: (r) => {
      const total = r.nextIntBetween(900, 12000);
      const active = total + r.nextIntBetween(40, 900);
      return `משתמשים פעילים היום: ${active}, רשומים במערכת: ${total}`;
    },
  },
  {
    kind: "empty_file",
    ok: (r) => {
      const rows = r.nextIntBetween(120, 9000);
      return `קובץ הייצוא: ${rows} שורות, ${rows * r.nextIntBetween(28, 60)} בייט`;
    },
    // Impossible: rows inside a zero-byte file.
    bad: (r) => `קובץ הייצוא: ${r.nextIntBetween(120, 9000)} שורות, 0 בייט`,
  },
  {
    kind: "run_window",
    ok: (r) => {
      const startH = r.nextIntBetween(1, 20);
      const durationMin = r.nextIntBetween(4, 55);
      return `הריצה הלילית: התחילה ב-0${startH}:00, הסתיימה ב-0${startH}:${durationMin < 10 ? `0${durationMin}` : durationMin}`;
    },
    // Impossible: finished before it started.
    bad: (r) => {
      const startH = r.nextIntBetween(3, 9);
      const endH = startH - r.nextIntBetween(1, 2);
      return `הריצה הלילית: התחילה ב-0${startH}:00, הסתיימה ב-0${endH}:${r.nextIntBetween(10, 55)}`;
    },
  },
  {
    kind: "disk",
    ok: (r) => {
      const capacity = r.nextIntBetween(200, 2000);
      const used = r.nextIntBetween(20, capacity);
      return `שטח אחסון בשימוש: ${used} GB מתוך ${capacity} GB`;
    },
    // Impossible: more storage used than exists.
    bad: (r) => {
      const capacity = r.nextIntBetween(200, 2000);
      return `שטח אחסון בשימוש: ${capacity + r.nextIntBetween(30, 400)} GB מתוך ${capacity} GB`;
    },
  },
];

export const template: ItemTemplate = {
  id: "speed.smell_the_number",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    // Four distinct shapes: one renders its impossible variant, three render
    // consistent ones. Distinct shapes mean the four lines can never collide
    // textually and the candidate can never argue a second line is "also off".
    const shapes = rng.sample(SHAPES, 4);
    const badShape = shapes[0] as MetricShape;
    const okShapes = shapes.slice(1);

    const correct = badShape.bad(rng);
    // Each of the three remaining shapes renders exactly one consistent line,
    // walked in order (never re-drawn at random) so no shape can appear twice
    // and the distinct-shape guarantee above is not wasted. `generate` stays
    // pure: the cursor is local to this call, so the same seed always
    // reproduces the same item.
    let nextOk = 0;
    const distractors = generateDistinctDistractors(
      3,
      [correct],
      () => (okShapes[nextOk++ % okShapes.length] as MetricShape).ok(rng),
      (v) => v,
    );
    const { options, correctIndex } = shuffleOptions(rng, correct, distractors);

    return {
      content: { prompt: "אחד מהנתונים בלוח הבקרה לא יכול להיות נכון. איזה?", options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
