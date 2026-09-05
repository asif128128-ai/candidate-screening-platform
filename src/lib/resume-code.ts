import { createHash, randomBytes } from "node:crypto";

// CANDIDATE_FLOW.md §2.4: an 8-character resume code from an unambiguous
// alphabet (no 0/O/1/I), shown once on the step-1 success screen and in the
// confirmation email, stored only as SHA-256 (`applications.resume_code_hash
// bytea`). `/resume` compares email + this code without needing email
// delivery to work (DECISIONS_LOG.md #2).

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, no 0/O/1/I
const CODE_LENGTH = 8;

/** Generates a random 8-character resume code (no formatting/dashes). */
export function generateResumeCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const byte = bytes[i]!;
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

/** Splits into two groups of 4 for display, e.g. "K7M4-Q2XP". */
export function formatResumeCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/** Strips whitespace/dashes and uppercases, so users can paste the displayed form back in. */
export function normalizeResumeCodeInput(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function hashResumeCode(code: string): Buffer {
  return createHash("sha256").update(code, "utf8").digest();
}

export function verifyResumeCode(code: string, hash: Buffer): boolean {
  const candidate = hashResumeCode(code);
  return candidate.length === hash.length && candidate.equals(hash);
}
