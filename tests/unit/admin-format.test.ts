import { describe, test, expect } from "vitest";
import {
  formatRelativeTime,
  scoreBand,
  isOverdueForReply,
  responseDueDate,
  dbSizeFraction,
  formatBytes,
  ageFromDob,
  DB_SIZE_WARNING_FRACTION,
} from "@/lib/admin-format";

describe("scoreBand", () => {
  test("bands per ADMIN_UX.md §3.4 thresholds", () => {
    expect(scoreBand(90)).toBe("high");
    expect(scoreBand(75)).toBe("high");
    expect(scoreBand(74.9)).toBe("mid");
    expect(scoreBand(50)).toBe("mid");
    expect(scoreBand(49.9)).toBe("low");
    expect(scoreBand(0)).toBe("low");
  });

  test("null/undefined score is unknown, not zero", () => {
    expect(scoreBand(null)).toBe("unknown");
    expect(scoreBand(undefined)).toBe("unknown");
  });
});

describe("isOverdueForReply (DECISIONS_LOG.md #3)", () => {
  const now = new Date("2026-02-01T00:00:00Z");

  test("not overdue before the response window elapses", () => {
    const appliedAt = new Date("2026-01-25T00:00:00Z"); // 7 days ago
    expect(isOverdueForReply(appliedAt, "assessment_completed", 14, now)).toBe(false);
  });

  test("overdue once the window passes and no decision was made", () => {
    const appliedAt = new Date("2026-01-01T00:00:00Z"); // 31 days ago
    expect(isOverdueForReply(appliedAt, "assessment_completed", 14, now)).toBe(true);
    expect(isOverdueForReply(appliedAt, "under_review", 14, now)).toBe(true);
  });

  test("never overdue before the candidate has actually finished the assessment (Fable's final review, DECISIONS_LOG #3: the reply-by promise is made on the done page, not at application time)", () => {
    const appliedAt = new Date("2026-01-01T00:00:00Z"); // 31 days ago
    expect(isOverdueForReply(appliedAt, "applied", 14, now)).toBe(false);
    expect(isOverdueForReply(appliedAt, "assessment_started", 14, now)).toBe(false);
  });

  test("interview stage is not overdue — reaching it means the candidate already got their reply", () => {
    const appliedAt = new Date("2026-01-01T00:00:00Z");
    expect(isOverdueForReply(appliedAt, "interview", 14, now)).toBe(false);
  });

  test("rejected or hired is never overdue, however long ago applied", () => {
    const appliedAt = new Date("2020-01-01T00:00:00Z");
    expect(isOverdueForReply(appliedAt, "rejected", 14, now)).toBe(false);
    expect(isOverdueForReply(appliedAt, "hired", 14, now)).toBe(false);
  });

  test("responseDueDate is exactly applied_at + window", () => {
    const appliedAt = new Date("2026-01-01T00:00:00Z");
    expect(responseDueDate(appliedAt, 14).toISOString()).toBe(
      new Date("2026-01-15T00:00:00Z").toISOString(),
    );
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  test("buckets: seconds, minutes, hours, days, months", () => {
    expect(formatRelativeTime(new Date("2026-01-10T11:59:55Z"), now)).toBe("עכשיו");
    expect(formatRelativeTime(new Date("2026-01-10T11:55:00Z"), now)).toContain("דקות");
    expect(formatRelativeTime(new Date("2026-01-10T09:00:00Z"), now)).toContain("שעות");
    expect(formatRelativeTime(new Date("2026-01-05T12:00:00Z"), now)).toContain("ימים");
    expect(formatRelativeTime(new Date("2025-10-01T12:00:00Z"), now)).toContain("חודשים");
  });
});

describe("DB size banner (DECISIONS_LOG.md #19)", () => {
  test("fraction is 0 for null/zero bytes", () => {
    expect(dbSizeFraction(null)).toBe(0);
    expect(dbSizeFraction(0)).toBe(0);
  });

  test("70% threshold matches the documented banner trigger", () => {
    const planBytes = 8 * 1024 * 1024 * 1024;
    const at69pct = planBytes * 0.69;
    const at70pct = planBytes * 0.7;
    expect(dbSizeFraction(at69pct) < DB_SIZE_WARNING_FRACTION).toBe(true);
    expect(dbSizeFraction(at70pct) >= DB_SIZE_WARNING_FRACTION).toBe(true);
  });

  test("formatBytes switches from MB to GB above 1024 MB", () => {
    expect(formatBytes(500 * 1024 * 1024)).toMatch(/MB/);
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toMatch(/GB/);
  });
});

describe("ageFromDob", () => {
  test("computes whole years, accounting for whether the birthday passed this year", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    expect(ageFromDob("2000-06-14", now)).toBe(26); // birthday already passed
    expect(ageFromDob("2000-06-16", now)).toBe(25); // birthday not yet reached
    expect(ageFromDob("2000-06-15", now)).toBe(26); // birthday is today
  });
});
