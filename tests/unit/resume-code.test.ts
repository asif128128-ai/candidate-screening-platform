import { describe, expect, it } from "vitest";
import {
  formatResumeCodeForDisplay,
  generateResumeCode,
  hashResumeCode,
  normalizeResumeCodeInput,
  verifyResumeCode,
} from "@/lib/resume-code";

describe("resume-code", () => {
  it("generates an 8-character code from the unambiguous alphabet (no 0/O/1/I)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateResumeCode();
      expect(code).toHaveLength(8);
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it("formats for display as XXXX-XXXX", () => {
    expect(formatResumeCodeForDisplay("K7M4Q2XP")).toBe("K7M4-Q2XP");
  });

  it("normalizes pasted input (strips dashes/whitespace, uppercases)", () => {
    expect(normalizeResumeCodeInput(" k7m4-q2xp ")).toBe("K7M4Q2XP");
  });

  it("hashes deterministically and verifies correctly", () => {
    const code = generateResumeCode();
    const hash = hashResumeCode(code);
    expect(verifyResumeCode(code, hash)).toBe(true);
    expect(verifyResumeCode("WRONGCODE", hash)).toBe(false);
  });

  it("never stores the plaintext code — only a SHA-256 digest is exposed by hashResumeCode", () => {
    const hash = hashResumeCode("ABCDEFGH");
    expect(hash).toBeInstanceOf(Buffer);
    expect(hash.length).toBe(32); // sha256 digest length
  });
});
