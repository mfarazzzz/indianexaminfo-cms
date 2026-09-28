// Unit tests for the non-blocking FAQ-editor warning rule (owner decision,
// Sprint 0 Part 2 2026-09-28): warn when an answer CONTAINS "not specified",
// "not available" or "to be announced"; stay silent on empty answers (handled
// by field validation elsewhere) and on real facts.
import { describe, it, expect } from "vitest";
import { faqAnswerWarning } from "./FaqAnswerWarning";

describe("faqAnswerWarning", () => {
  it("warns on the three no-fact phrases, case-insensitively", () => {
    for (const a of ["Not specified", "not available yet", "TO BE ANNOUNCED"]) {
      expect(faqAnswerWarning(a)).toBe(
        "This answer gives the reader no fact. Add the fact or remove the question.",
      );
    }
  });

  it("warns inside a full sentence too (editor rule is broader than the site hiding rule)", () => {
    expect(faqAnswerWarning("The fee is not specified on the notification.")).toContain("no fact");
  });

  it("stays silent on empty answers and on real facts", () => {
    expect(faqAnswerWarning("")).toBeNull();
    expect(faqAnswerWarning("   ")).toBeNull();
    expect(faqAnswerWarning(null)).toBeNull();
    expect(faqAnswerWarning(undefined)).toBeNull();
    expect(faqAnswerWarning("The exam fee is Rs 1000."))
      .toBeNull();
  });
});
