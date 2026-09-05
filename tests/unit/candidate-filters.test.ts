import { describe, test, expect } from "vitest";
import {
  parseCandidateFilters,
  serializeCandidateFilters,
  quickFilterPatch,
  DEFAULT_FILTERS,
  isKeysetSortField,
} from "@/lib/candidate-filters";
import type { ApplicationStage, IntegrityRisk } from "@/db/queries/types";
import type { ScoreBand } from "@/lib/admin-format";

describe("parseCandidateFilters", () => {
  test("defaults when nothing is given", () => {
    const f = parseCandidateFilters(new URLSearchParams(""));
    expect(f).toEqual(DEFAULT_FILTERS);
  });

  test("parses every filter kind from a query string", () => {
    const params = new URLSearchParams(
      "job=abc&quick=top&stage=interview,rejected&integrity=high&band=high,low" +
        "&rishon=yes&has_cv=1&has_github=1&year=1,2,3&institution=X,Y" +
        "&from=2026-01-01&to=2026-02-01&dup_phone=1&q=%D7%99%D7%A2%D7%9C" +
        "&sort=applied_at&dir=asc&cursor=abc123&offset=50",
    );
    const f = parseCandidateFilters(params);
    expect(f.jobId).toBe("abc");
    expect(f.quick).toBe("top");
    expect(f.stage).toEqual(["interview", "rejected"]);
    expect(f.integrity).toEqual(["high"]);
    expect(f.overallBand).toEqual(["high", "low"]);
    expect(f.canWorkRishon).toBe("yes");
    expect(f.hasCv).toBe(true);
    expect(f.hasGithub).toBe(true);
    expect(f.hasLinkedin).toBe(false);
    expect(f.studyYear).toEqual([1, 2, 3]);
    expect(f.institution).toEqual(["X", "Y"]);
    expect(f.appliedFrom).toBe("2026-01-01");
    expect(f.appliedTo).toBe("2026-02-01");
    expect(f.dupPhone).toBe(true);
    expect(f.q).toBe("יעל");
    expect(f.sort).toBe("applied_at");
    expect(f.dir).toBe("asc");
    expect(f.cursor).toBe("abc123");
    expect(f.offset).toBe(50);
  });

  test("drops invalid enum-like values instead of throwing", () => {
    const f = parseCandidateFilters(
      new URLSearchParams("quick=not-a-real-filter&stage=bogus,interview&sort=not-a-field"),
    );
    expect(f.quick).toBe("all");
    expect(f.stage).toEqual(["interview"]);
    expect(f.sort).toBe("score_overall");
  });

  test("never accepts academic average as a sort field (ADMIN_UX.md §3.3: 'never a filter or sort key')", () => {
    const f = parseCandidateFilters(new URLSearchParams("sort=academic_average"));
    expect(f.sort).toBe("score_overall");
  });

  test("accepts a plain Record (as Next.js server components receive searchParams)", () => {
    const f = parseCandidateFilters({ job: "abc", stage: ["interview"] });
    expect(f.jobId).toBe("abc");
    expect(f.stage).toEqual(["interview"]);
  });
});

describe("serializeCandidateFilters / parseCandidateFilters round-trip", () => {
  test("a full filter set survives a serialize -> parse round trip", () => {
    const original = {
      ...DEFAULT_FILTERS,
      jobId: "job-1",
      stage: ["interview", "hired"] as ApplicationStage[],
      integrity: ["medium", "high"] as IntegrityRisk[],
      overallBand: ["high"] as ScoreBand[],
      canWorkRishon: "no" as const,
      hasCv: true,
      studyYear: [2, 3],
      institution: ["Tel Aviv University"],
      appliedFrom: "2026-01-01",
      dupPhone: true,
      q: "כהן",
      sort: "pct_rank" as const,
      dir: "asc" as const,
    };
    const query = serializeCandidateFilters(original);
    const roundTripped = parseCandidateFilters(new URLSearchParams(query));
    expect(roundTripped).toMatchObject(original);
  });

  test("default values are omitted from the query string (short, stable URLs)", () => {
    const query = serializeCandidateFilters({ jobId: "job-1" });
    expect(query).toBe("job=job-1");
  });
});

describe("quickFilterPatch", () => {
  test("מובילים sorts by overall desc", () => {
    expect(quickFilterPatch("top")).toMatchObject({ sort: "score_overall", dir: "desc" });
  });

  test("לבדיקת אמינות does not filter integrity out of view, it filters it in (never hides flagged candidates)", () => {
    const patch = quickFilterPatch("integrity_review");
    expect(patch.integrity).toEqual(["medium", "high"]);
  });

  test("הכול resets stage/integrity/band", () => {
    const patch = quickFilterPatch("all");
    expect(patch.stage).toEqual([]);
    expect(patch.integrity).toEqual([]);
    expect(patch.overallBand).toEqual([]);
  });
});

describe("isKeysetSortField", () => {
  test("score/percentile/date fields use keyset pagination; text fields don't", () => {
    expect(isKeysetSortField("score_overall")).toBe(true);
    expect(isKeysetSortField("pct_rank")).toBe(true);
    expect(isKeysetSortField("applied_at")).toBe(true);
    expect(isKeysetSortField("name")).toBe(false);
    expect(isKeysetSortField("stage")).toBe(false);
    expect(isKeysetSortField("institution")).toBe(false);
  });
});
