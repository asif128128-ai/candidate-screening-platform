// knowledge.format_valid — which value of four is well-formed, across the
// everyday formats this role handles. ASSESSMENT_DESIGN.md §3.5.
//
// One family covering several formats (email, port, hex colour, MAC,
// date, Israeli phone) rather than one family each: the generator serves at
// most one item per family per session, so folding them together means a
// candidate meets a *random* format rather than all six.
import type { Rng } from "../../rng";
import { defineValidityTemplate } from "./helpers";

const NAMES = ["dana", "yossi", "maya", "ori", "noa", "alon"];
const DOMAINS = ["example.co.il", "hachevra.com", "mail.org", "shivuk.net"];
const hex = (r: Rng, n: number) => Array.from({ length: n }, () => "0123456789abcdef"[r.nextInt(16)]).join("");

export const template = defineValidityTemplate({
  id: "knowledge.format_valid",
  ask: (label) => `איזה מהערכים הבאים הוא ${label} תקין?`,
  kinds: [
    {
      label: "כתובת אימייל",
      valid: (r) => `${r.pick(NAMES)}@${r.pick(DOMAINS)}`,
      invalid: [
        (r) => `${r.pick(NAMES)}@@${r.pick(DOMAINS)}`,
        (r) => `${r.pick(NAMES)}${r.pick(DOMAINS)}`,
        (r) => `${r.pick(NAMES)}@${r.pick(DOMAINS).split(".")[0]}`,
        (r) => `${r.pick(NAMES)} ${r.pick(NAMES)}@${r.pick(DOMAINS)}`,
        (r) => `@${r.pick(DOMAINS)}`,
      ],
    },
    {
      label: "מספר פורט",
      valid: (r) => String(r.nextIntBetween(1, 65535)),
      invalid: [
        (r) => String(r.nextIntBetween(65536, 99999)),
        (r) => `-${r.nextIntBetween(1, 999)}`,
        (r) => `${r.nextIntBetween(1, 9999)}.${r.nextIntBetween(1, 9)}`,
        (r) => `port${r.nextIntBetween(80, 9000)}`,
      ],
    },
    {
      label: "קוד צבע hex",
      valid: (r) => `#${hex(r, 6)}`,
      invalid: [
        (r) => `#${hex(r, 5)}`,
        (r) => `#${hex(r, 4)}${r.pick(["g", "z", "k"])}${hex(r, 1)}`,
        (r) => hex(r, 6),
        (r) => `#${hex(r, 8)}${r.pick(["g", "x"])}`,
      ],
    },
    {
      label: "כתובת MAC",
      valid: (r) => Array.from({ length: 6 }, () => hex(r, 2)).join(":"),
      invalid: [
        (r) => Array.from({ length: 5 }, () => hex(r, 2)).join(":"),
        (r) => Array.from({ length: 6 }, () => hex(r, 2)).join("."),
        (r) => Array.from({ length: 6 }, () => hex(r, 3)).join(":"),
        (r) => `${Array.from({ length: 5 }, () => hex(r, 2)).join(":")}:${r.pick(["zz", "gg"])}`,
      ],
    },
    {
      label: "תאריך בפורמט ISO",
      valid: (r) =>
        `2026-${String(r.nextIntBetween(1, 12)).padStart(2, "0")}-${String(r.nextIntBetween(1, 28)).padStart(2, "0")}`,
      invalid: [
        (r) => `2026-${r.nextIntBetween(13, 20)}-${String(r.nextIntBetween(1, 28)).padStart(2, "0")}`,
        (r) => `${String(r.nextIntBetween(1, 28)).padStart(2, "0")}-${String(r.nextIntBetween(1, 12)).padStart(2, "0")}-2026`,
        (r) => `2026-${String(r.nextIntBetween(1, 12)).padStart(2, "0")}-${r.nextIntBetween(32, 45)}`,
        (r) => `2026/${String(r.nextIntBetween(1, 12)).padStart(2, "0")}/${String(r.nextIntBetween(1, 28)).padStart(2, "0")}`,
      ],
    },
  ],
});
