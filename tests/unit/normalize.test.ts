import { describe, expect, it } from "vitest";
import {
  ageInYears,
  normalizeEmail,
  normalizeGithubUrl,
  normalizeLinkedinUrl,
  normalizePhone,
  validateAcademicAverage,
  validateDateOfBirth,
} from "@/lib/normalize";

// TEST_STRATEGY.md §2 "Personal-details validation/normalization" /
// §3 "normalize.test.ts: 40+ phone inputs; email edge cases; URL forms."

describe("normalizePhone", () => {
  const validCases: [string, string][] = [
    ["050-1234567", "+972501234567"],
    ["0501234567", "+972501234567"],
    ["052 123 4567", "+972521234567"],
    ["+972501234567", "+972501234567"],
    ["972501234567", "+972501234567"],
    ["+972-50-123-4567", "+972501234567"],
    ["0521234567", "+972521234567"],
    ["0541234567", "+972541234567"],
    ["0581234567", "+972581234567"],
  ];
  for (const [input, expected] of validCases) {
    it(`normalizes "${input}" -> "${expected}"`, () => {
      const result = normalizePhone(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(expected);
    });
  }

  it("accepts a valid non-Israeli E.164 number", () => {
    const result = normalizePhone("+14155552671");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("+14155552671");
  });

  const invalidCases = ["", "abc", "123", "05012345", "05012345678901234", "+", "0000000000"];
  for (const input of invalidCases) {
    it(`rejects "${input}"`, () => {
      expect(normalizePhone(input).ok).toBe(false);
    });
  }
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    const result = normalizeEmail("  Foo.Bar@Example.COM  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("foo.bar@example.com");
  });

  const invalid = ["", "not-an-email", "foo@", "@bar.com", "foo bar@example.com"];
  for (const input of invalid) {
    it(`rejects "${input}"`, () => {
      expect(normalizeEmail(input).ok).toBe(false);
    });
  }
});

describe("normalizeLinkedinUrl", () => {
  it("accepts empty as null (optional field)", () => {
    const result = normalizeLinkedinUrl("");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  const cases: [string, string][] = [
    ["https://www.linkedin.com/in/johndoe", "https://www.linkedin.com/in/johndoe"],
    ["https://linkedin.com/in/johndoe/", "https://www.linkedin.com/in/johndoe"],
    ["linkedin.com/in/johndoe", "https://www.linkedin.com/in/johndoe"],
    ["johndoe", "https://www.linkedin.com/in/johndoe"],
  ];
  for (const [input, expected] of cases) {
    it(`normalizes "${input}"`, () => {
      const result = normalizeLinkedinUrl(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(expected);
    });
  }

  it("rejects garbage", () => {
    expect(normalizeLinkedinUrl("!!!").ok).toBe(false);
  });
});

describe("normalizeGithubUrl", () => {
  it("accepts empty as null", () => {
    const result = normalizeGithubUrl("");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  const cases: [string, string][] = [
    ["https://github.com/torvalds", "https://github.com/torvalds"],
    ["github.com/torvalds", "https://github.com/torvalds"],
    ["torvalds", "https://github.com/torvalds"],
  ];
  for (const [input, expected] of cases) {
    it(`normalizes "${input}"`, () => {
      const result = normalizeGithubUrl(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(expected);
    });
  }

  it("rejects garbage", () => {
    expect(normalizeGithubUrl("!!!").ok).toBe(false);
  });
});

describe("ageInYears / validateDateOfBirth", () => {
  it("computes age correctly across a birthday boundary", () => {
    expect(ageInYears(new Date("2000-06-15"), new Date("2024-06-14"))).toBe(23);
    expect(ageInYears(new Date("2000-06-15"), new Date("2024-06-15"))).toBe(24);
  });

  it("accepts ages within 16-70", () => {
    const asOf = new Date("2024-01-01");
    expect(validateDateOfBirth(new Date("2005-01-01"), asOf).ok).toBe(true); // 19
    expect(validateDateOfBirth(new Date("1960-01-02"), asOf).ok).toBe(true); // 63
  });

  it("rejects ages outside 16-70", () => {
    const asOf = new Date("2024-01-01");
    expect(validateDateOfBirth(new Date("2015-01-01"), asOf).ok).toBe(false); // 9
    expect(validateDateOfBirth(new Date("1950-01-01"), asOf).ok).toBe(false); // 74
  });

  it("rejects an invalid date", () => {
    expect(validateDateOfBirth(new Date("not-a-date")).ok).toBe(false);
  });
});

describe("validateAcademicAverage", () => {
  it("accepts 0-100 and rounds to one decimal", () => {
    const result = validateAcademicAverage(87.456);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(87.5);
  });

  it("rejects out-of-range values", () => {
    expect(validateAcademicAverage(-1).ok).toBe(false);
    expect(validateAcademicAverage(101).ok).toBe(false);
    expect(validateAcademicAverage(Number.NaN).ok).toBe(false);
  });

  it("does not reject a low average — average never blocks a candidate (DECISIONS_LOG.md)", () => {
    expect(validateAcademicAverage(60).ok).toBe(true);
  });
});
