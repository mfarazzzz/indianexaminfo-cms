/**
 * jobPostingGaps.test.ts — owner batch 9, H2.
 *
 * THE RULE. "What was NOT found" is derived from JOBPOSTING_GATES, the single definition of
 * what a JobPosting needs, so this file also pins the JOIN between the checklist and the
 * extractor: if a gate column is renamed, or an extractor field is renamed, the mapping below
 * stops matching and these tests fail rather than the page silently going quiet.
 *
 * THE HONESTY RULE. Two gates can never be read out of a notice's TEXT — the official
 * notification URL is the notice's own address, and verification is an editorial act. They must
 * still be REPORTED (with the action that satisfies them), because an empty list would read as
 * "the row is ready" when it is not.
 */
import { describe, expect, it } from "vitest";
import { jobPostingGaps } from "./jobPostingGaps";
import { JOBPOSTING_GATES } from "@/lib/utils/vacancyBulkOps";

const COLUMNS = JOBPOSTING_GATES.map((g) => g.column);

describe("jobPostingGaps — what the checklist still needs", () => {
  it("lists every gate when the extractor found nothing, in checklist order", () => {
    const gaps = jobPostingGaps([]);
    expect(gaps.map((g) => g.column)).toEqual([...COLUMNS]);
  });

  it("drops exactly the gate a proposal satisfies, and keeps the rest", () => {
    const gaps = jobPostingGaps([{ field: "applicationEndDate" }]);
    expect(gaps.map((g) => g.column)).not.toContain("application_end_date");
    expect(gaps.map((g) => g.column)).toContain("notification_date");
    expect(gaps.map((g) => g.column)).toContain("application_start_date");
    expect(gaps.length).toBe(COLUMNS.length - 1);
  });

  it("marks the two gates a notice's TEXT can never supply", () => {
    const gaps = jobPostingGaps([
      { field: "notificationDate" },
      { field: "applicationStartDate" },
      { field: "applicationEndDate" },
    ]);
    // Every text-readable gate is satisfied...
    expect(gaps.map((g) => g.column)).toEqual(["official_notification_url", "__verified__"]);
    // ...and the two that remain say so, with an action rather than a shrug.
    expect(gaps.every((g) => g.fromText === false)).toBe(true);
    expect(gaps[0].hint).toMatch(/not in the text/i);
    expect(gaps[1].hint).toMatch(/verify/i);
  });

  it("does not narrow a gap for a field the checklist does not gate on", () => {
    // fee / age / count are useful to an editor but satisfy no JobPosting condition.
    const gaps = jobPostingGaps([
      { field: "applicationFee" },
      { field: "ageLimit" },
      { field: "vacancyCount" },
      { field: "title" },
      { field: "organization" },
    ]);
    expect(gaps.length).toBe(COLUMNS.length);
  });

  it("every gap carries the checklist label and a non-empty hint", () => {
    for (const gap of jobPostingGaps([])) {
      expect(gap.label.length).toBeGreaterThan(0);
      expect(gap.hint.length).toBeGreaterThan(0);
      // The label is the checklist's own wording, never a second copy.
      expect(JOBPOSTING_GATES.find((g) => g.column === gap.column)?.label).toBe(gap.label);
    }
  });
});
