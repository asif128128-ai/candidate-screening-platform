// knowledge.ip_valid — which of four is a valid IPv4 address.
// ASSESSMENT_DESIGN.md §3.5.
//
// This family previously lived in the speed block, where it was tagged
// `fluency: true` and then retired in Round 3 for measuring prior exposure
// rather than processing speed. That judgement was right about what it
// measures and wrong about whether we want it: the client explicitly wants
// technology knowledge tested, so it returns here — in the block whose whole
// purpose is recall — instead of being dropped (DECISIONS_LOG.md #25).
//
// Unlike the old version it no longer states the "four numbers 0-255" rule
// inside the item. Stating it turned the question into "is 300 greater than
// 255", which is arithmetic; knowing the shape of an address is the point.
import type { Rng } from "../../rng";
import { defineValidityTemplate } from "./helpers";

const octet = (r: Rng) => r.nextIntBetween(0, 255);

export const template = defineValidityTemplate({
  id: "knowledge.ip_valid",
  ask: () => "איזו מהכתובות הבאות היא כתובת IP תקינה?",
  kinds: [
    {
      label: "IP",
      valid: (r) => `${octet(r)}.${octet(r)}.${octet(r)}.${octet(r)}`,
      invalid: [
        // An octet above the maximum.
        (r) => `${octet(r)}.${octet(r)}.${r.nextIntBetween(256, 999)}.${octet(r)}`,
        // Three octets instead of four.
        (r) => `${octet(r)}.${octet(r)}.${octet(r)}`,
        // Five octets.
        (r) => `${octet(r)}.${octet(r)}.${octet(r)}.${octet(r)}.${octet(r)}`,
        // A letter where a number belongs.
        (r) => `${octet(r)}.${octet(r)}.${r.pick(["a", "x", "o"])}.${octet(r)}`,
        // Empty octet (double dot).
        (r) => `${octet(r)}..${octet(r)}.${octet(r)}`,
        // Negative octet.
        (r) => `${octet(r)}.-${r.nextIntBetween(1, 99)}.${octet(r)}.${octet(r)}`,
      ],
    },
  ],
});
