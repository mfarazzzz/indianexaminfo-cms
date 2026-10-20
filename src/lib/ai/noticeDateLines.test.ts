/**
 * noticeDateLines.test.ts — S2.15 deterministic date-line extraction, proven on
 * the REAL UPSSSC PET 17-Oct-2026 notice text. No network, no model.
 */
import { describe, it, expect } from "vitest";
import {
  parseDateList, extractNoticeDateLines, mergeNoticeRows, supersedeCandidates, planSlotFill,
} from "./noticeDateLines";
import type { PipelineDateRow } from "./noticePipeline";

const row = (over: Partial<PipelineDateRow>): PipelineDateRow => ({
  label: "x", date: "2026-01-01", type: "other", kind: "other", isUrgent: false,
  state: "confirmed", verified: false, source_quote: "", confidence: 1, ...over,
});

describe("parseDateList — multi-date lists expand to one ISO per date", () => {
  it("comma + ampersand list with a leading bare day inheriting month/year", () => {
    expect(parseDateList("25, 30 October 2026 & 01 November 2026", 2026))
      .toEqual(["2026-10-25", "2026-10-30", "2026-11-01"]);
  });
  it("a header list '23, 24 & 25 October 2026'", () => {
    expect(parseDateList("23, 24 & 25 October 2026", 2026))
      .toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
  });
  it("a day range '25-27 Oct 2026' expands each day", () => {
    expect(parseDateList("25-27 Oct 2026", 2026))
      .toEqual(["2026-10-25", "2026-10-26", "2026-10-27"]);
  });
  it("'25 & 26 October' inherits the year", () => {
    expect(parseDateList("25 & 26 October", 2026)).toEqual(["2026-10-25", "2026-10-26"]);
  });
  it("a single date and a no-date value", () => {
    expect(parseDateList("12 October 2026", 2026)).toEqual(["2026-10-12"]);
    expect(parseDateList("After Exam", 2026)).toEqual([]);
  });
});

// The exact Important-Dates block + the contradicting header line from the notice.
const PET = [
  "Name of Exam: UPSSSC Preliminary Eligibility Test (PET) Admit Card 2026 | Exam Dates: 23, 24 & 25 October 2026",
  "Short Information: The Uttar Pradesh Subordinate Service Selection Commission (UPSSSC) has released the admit card and revised exam dates. The written examination is scheduled to be held on 25, 30 October 2026 & 1 November 2026.",
  "Important Dates",
  "Revised PET Written Exam Dates: 25, 30 October 2026 & 01 November 2026",
  "Exam City Details Out Date: 12 October 2026",
  "Admit Card Available: 17 October 2026",
  "Answer Key Available: After Exam",
  "Exam Details",
  "Conducting Body: UPSSSC, Lucknow",
  "Status: Exam Date Out",
].join("\n");

describe("extractNoticeDateLines — the PET notice (2a + 2b)", () => {
  const res = extractNoticeDateLines(PET, 2026, "written-exam");

  it("produces exactly three exam_written rows (25, 30 Oct, 1 Nov) — the header's 23/24 are NOT rows", () => {
    const exam = res.rows.filter((r) => r.type === "exam_written").map((r) => r.date).sort();
    expect(exam).toEqual(["2026-10-25", "2026-10-30", "2026-11-01"]);
    expect(res.rows.some((r) => r.date === "2026-10-23")).toBe(false);
    expect(res.rows.some((r) => r.date === "2026-10-24")).toBe(false);
  });

  it("derives exam_written (not exam_physical) for the 'PET' written-exam line", () => {
    const r = res.rows.find((x) => x.date === "2026-10-30");
    expect(r?.kind).toBe("exam_written");
    expect(r?.type).toBe("exam_written");
    expect(r?.source).toBe("notice-line");
  });

  it("exam city (12 Oct) and admit card (17 Oct) become their own typed rows", () => {
    expect(res.rows.find((r) => r.date === "2026-10-12")?.type).toBe("exam_city_intimation");
    expect(res.rows.find((r) => r.date === "2026-10-17")?.type).toBe("admit_card");
  });

  it("relative lines become notes, never dated rows", () => {
    const texts = res.notes.map((n) => n.text);
    expect(texts).toContain("Answer Key Available: After Exam");
    expect(texts).toContain("Status: Exam Date Out");
    expect(res.rows.some((r) => r.type === "answer_key")).toBe(false);
  });

  it("the header/summary exam-date line is overridden with a visible conflict warning", () => {
    expect(res.conflicts.length).toBeGreaterThan(0);
    expect(res.conflicts.join(" ")).toMatch(/Exam Dates \(23 Oct.*25 Oct\)/);
    expect(res.conflicts.join(" ")).toMatch(/overridden by Revised PET Written Exam Dates/);
  });

  it("the 'Short Information' prose paragraph is never mined for dates", () => {
    // It would otherwise add 'other' rows; guard: no row cites the prose line.
    expect(res.rows.every((r) => !r.source_quote.startsWith("Short Information"))).toBe(true);
  });
});

describe("mergeNoticeRows — deterministic wins, union by date+type", () => {
  it("a model row never overrides a deterministic row on the same date+type", () => {
    const det = [row({ date: "2026-10-30", type: "exam_written", kind: "exam_written", source: "notice-line", label: "Revised (30 Oct)" })];
    const model = [row({ date: "2026-10-30", type: "exam_written", kind: "exam_written", label: "Model label" })];
    const merged = mergeNoticeRows(model, det);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("notice-line");
  });
  it("keeps model-only rows and det-only rows", () => {
    const det = [row({ date: "2026-11-01", type: "exam_written" })];
    const model = [row({ date: "2026-10-17", type: "admit_card" })];
    expect(mergeNoticeRows(model, det).map((r) => r.date).sort()).toEqual(["2026-10-17", "2026-11-01"]);
  });
});

describe("supersedeCandidates — a revision flags the stale exam row for removal", () => {
  it("default-removes a system-seeded exam row whose date is not in the new set", () => {
    const existing = [{ label: "PET Exam", date: "2026-10-06", type: "exam_physical", verified: false }];
    const det = [row({ date: "2026-10-25", type: "exam_physical", kind: "exam_physical" })];
    const c = supersedeCandidates(existing, det);
    expect(c).toHaveLength(1);
    expect(c[0].defaultRemove).toBe(true);
    expect(c[0].row.date).toBe("2026-10-06");
  });
  it("a human-verified row is NOT default-removed (needs an explicit tick)", () => {
    const existing = [{ label: "Exam", date: "2026-10-06", type: "exam_written", verified: true }];
    const det = [row({ date: "2026-10-25", type: "exam_written", kind: "exam_written" })];
    const c = supersedeCandidates(existing, det);
    expect(c[0].defaultRemove).toBe(false);
  });
  it("a same-date row is not superseded", () => {
    const existing = [{ label: "Exam", date: "2026-10-25", type: "exam_written", verified: false }];
    const det = [row({ date: "2026-10-25", type: "exam_written", kind: "exam_written" })];
    expect(supersedeCandidates(existing, det)).toHaveLength(0);
  });
});

describe("planSlotFill — fill an empty standard slot instead of adding a custom row", () => {
  it("routes a row to the empty slot of the same type", () => {
    const existing = [
      { label: "Admit Card Release", type: "admit_card", date: "" },
      { label: "Exam Date", type: "exam_written", date: "" },
    ];
    const incoming = [row({ date: "2026-10-17", type: "admit_card" }), row({ date: "2026-10-25", type: "exam_written" })];
    const plan = planSlotFill(incoming, existing);
    expect(plan.find((p) => p.type === "admit_card")?.slotIndex).toBe(0);
    expect(plan.find((p) => p.type === "exam_written")?.slotIndex).toBe(1);
  });
  it("a second date of the same type has no empty slot left → custom row (null)", () => {
    const existing = [{ label: "Exam Date", type: "exam_written", date: "" }];
    const incoming = [row({ date: "2026-10-25", type: "exam_written" }), row({ date: "2026-10-30", type: "exam_written" })];
    const plan = planSlotFill(incoming, existing);
    expect(plan[0].slotIndex).toBe(0);
    expect(plan[1].slotIndex).toBeNull();
  });
  it("an already-filled standard row is not a slot", () => {
    const existing = [{ label: "Admit Card Release", type: "admit_card", date: "2026-09-01" }];
    const plan = planSlotFill([row({ date: "2026-10-17", type: "admit_card" })], existing);
    expect(plan[0].slotIndex).toBeNull();
  });
});
