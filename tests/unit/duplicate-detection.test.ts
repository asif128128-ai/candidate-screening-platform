import { describe, expect, it } from "vitest";
import { decideDuplicateOutcome } from "@/lib/duplicate-detection";

// TEST_STRATEGY.md §2 "Duplicate signals": same email+job resumes, same
// email other job pre-fills (create_new here), same phone flags
// duplicate_phone_of, never blocks.

describe("decideDuplicateOutcome", () => {
  it("creates a new application when there's no signal at all", () => {
    const result = decideDuplicateOutcome("a@example.com", null, null);
    expect(result).toEqual({ kind: "create_new", duplicatePhoneOfCandidateId: null });
  });

  it("redirects to resume when the same job application exists and isn't completed", () => {
    const result = decideDuplicateOutcome(
      "a@example.com",
      { applicationId: "app-1", completed: false, responseByDate: new Date("2030-01-01") },
      null,
    );
    expect(result).toEqual({ kind: "redirect_to_resume", prefillEmail: "a@example.com" });
  });

  it("reports already_completed when the same job application is completed", () => {
    const responseByDate = new Date("2030-01-01");
    const result = decideDuplicateOutcome(
      "a@example.com",
      { applicationId: "app-1", completed: true, responseByDate },
      null,
    );
    expect(result).toEqual({ kind: "already_completed", responseByDate });
  });

  it("creates a new application AND carries the phone-match candidate id — never blocks", () => {
    const result = decideDuplicateOutcome("a@example.com", null, "candidate-2");
    expect(result).toEqual({ kind: "create_new", duplicatePhoneOfCandidateId: "candidate-2" });
  });

  it("prioritizes the same-job signal over a coincidental phone match", () => {
    const result = decideDuplicateOutcome(
      "a@example.com",
      { applicationId: "app-1", completed: false, responseByDate: new Date() },
      "candidate-2",
    );
    expect(result.kind).toBe("redirect_to_resume");
  });
});
