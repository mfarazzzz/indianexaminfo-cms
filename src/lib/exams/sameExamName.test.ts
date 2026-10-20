/**
 * sameExamName.test.ts — A.4 normalized-name-core matcher, proven with the REAL
 * names from the duplicate census. It must catch every same-exam pair the
 * exact-Name/Short-Name guards missed, and must NOT fire on the two genuinely
 * different AIIMS records (an entrance exam vs a staff recruitment).
 */
import { describe, it, expect } from "vitest";
import { examNameCore, isSameExamNameCore } from "./sameExamName";

describe("examNameCore — identity core extraction", () => {
  it("drops years, punctuation, stop-words and connector words", () => {
    expect(examNameCore("UPSC Combined Medical Services CMS Examination 2026")).toEqual([
      "upsc", "combined", "medical", "services", "cms",
    ]);
    expect(examNameCore("RPF Constable & Sub-Inspector (SI) Recruitment")).toEqual([
      "rpf", "constable", "sub", "inspector", "si",
    ]);
  });
  it("is case-insensitive and de-duplicates tokens", () => {
    expect(examNameCore("UGC NET (National Eligibility Test)")).toEqual([
      "ugc", "net", "national", "eligibility", "test",
    ]);
  });
});

describe("isSameExamNameCore — the five real same-exam pairs MUST match", () => {
  it("UPSC CMS (evergreen vs year-suffixed)", () => {
    expect(isSameExamNameCore(
      "UPSC Combined Medical Services",
      "UPSC Combined Medical Services CMS Examination 2026",
    )).toBe(true);
  });
  it("RPF Constable & SI (with vs without the (SI) Recruitment suffix)", () => {
    expect(isSameExamNameCore(
      "RPF Constable & Sub-Inspector",
      "RPF Constable & Sub-Inspector (SI) Recruitment",
    )).toBe(true);
  });
  it("CDS (Examination 2026 vs bare)", () => {
    expect(isSameExamNameCore(
      "Combined Defence Services Examination 2026",
      "Combined Defence Services",
    )).toBe(true);
  });
  it("NDA (Examination 2026 vs 'NDA Exam (National Defence Academy)')", () => {
    expect(isSameExamNameCore(
      "National Defence Academy Examination 2026",
      "NDA Exam (National Defence Academy)",
    )).toBe(true);
  });
  it("UGC NET (parenthetical vs year-suffixed)", () => {
    expect(isSameExamNameCore(
      "UGC NET (National Eligibility Test)",
      "UGC National Eligibility Test 2026",
    )).toBe(true);
  });
});

describe("isSameExamNameCore — the AIIMS pair must NOT match (different exams)", () => {
  it("AIIMS Nursing entrance vs Nursing Officer recruitment", () => {
    expect(isSameExamNameCore(
      "AIIMS B.Sc and M.Sc Nursing Entrance",
      "AIIMS Nursing Officer Recruitment",
    )).toBe(false);
  });
});

describe("isSameExamNameCore — guards", () => {
  it("a 1-2 token core never matches (avoids 'PET' matching everything)", () => {
    expect(isSameExamNameCore("UPSSSC PET", "KP Constable PET Recruitment")).toBe(false);
  });
  it("empty / blank names do not match", () => {
    expect(isSameExamNameCore("", "UPSC Combined Medical Services")).toBe(false);
    expect(isSameExamNameCore("   ", "  ")).toBe(false);
  });
  it("symmetric", () => {
    const a = "UGC National Eligibility Test 2026";
    const b = "UGC NET (National Eligibility Test)";
    expect(isSameExamNameCore(a, b)).toBe(isSameExamNameCore(b, a));
  });
});
