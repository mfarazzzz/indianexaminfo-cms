/**
 * S3.2 verification lib — pure rules shared by the editor Verify control and
 * the D6 triage queue. Pins the owner-locked decisions:
 *  – the exact block reasons and their order (permission first, unsaved last);
 *  – verified = flag + date ONLY, and a >90-day stamp is a re-check FLAG,
 *    never an automatic expiry (decision 5);
 *  – triage order = nearest upcoming date first, no-date rows last,
 *    featured breaks ties (decision 2).
 */
import { describe, it, expect } from "vitest";
import {
  isoDateValid, validDates, hasDuplicateDay, pickNextUpcomingDate, daysUntil,
  verifyBlockReasons, readyToVerify, needsRecheck, buildQueueRow, sortQueueRows,
  RECHECK_AFTER_DAYS, type VerifyStateInput, type QueueSourceRow,
} from "./verification";

const TODAY = "2026-10-21";

const input = (over: Partial<VerifyStateInput> = {}): VerifyStateInput => ({
  name: "UPSSSC PET",
  conductingBody: "UPSSSC",
  officialWebsite: "https://upsssc.gov.in",
  selectionAnswered: true,
  dates: [{ date: "2026-11-01" }],
  hasUnsavedChanges: false,
  canPublish: true,
  ...over,
});

describe("isoDateValid / date helpers", () => {
  it("accepts only real ISO calendar days", () => {
    expect(isoDateValid("2026-10-21")).toBe(true);
    expect(isoDateValid("2026-02-30")).toBe(false); // day does not exist
    expect(isoDateValid("21.10.2026")).toBe(false); // Indian printed form is NOT stored ISO
    expect(isoDateValid("2026-2-3")).toBe(false);   // not zero-padded
    expect(isoDateValid(null)).toBe(false);
    expect(isoDateValid(undefined)).toBe(false);
  });

  it("pickNextUpcomingDate returns the earliest FUTURE date only", () => {
    expect(pickNextUpcomingDate([{ date: "2026-10-06" }, { date: "2026-11-01" }, { date: "2026-10-30" }], TODAY))
      .toBe("2026-10-30");
    expect(pickNextUpcomingDate([{ date: "2026-10-06" }, { date: "2026-10-21" }], TODAY)).toBeNull(); // today is not upcoming
  });

  it("hasDuplicateDay flags same-day rows (invalid dates ignored)", () => {
    expect(hasDuplicateDay([{ date: "2026-10-25" }, { date: "2026-10-25" }])).toBe(true);
    expect(hasDuplicateDay([{ date: "2026-10-25" }, { date: "2026-10-30" }])).toBe(false);
    expect(hasDuplicateDay([{ date: "" }, { date: "" }])).toBe(false);
  });

  it("daysUntil: whole days, null propagates", () => {
    expect(daysUntil("2026-10-26", TODAY)).toBe(5);
    expect(daysUntil("2026-10-06", TODAY)).toBe(-15);
    expect(daysUntil(null, TODAY)).toBeNull();
  });
});

describe("verifyBlockReasons — exact reasons, exact order", () => {
  it("a complete record has NO reasons — ready to verify", () => {
    expect(verifyBlockReasons(input())).toEqual([]);
    expect(readyToVerify(input())).toBe(true);
  });

  it("permission is the FIRST reason when missing", () => {
    expect(verifyBlockReasons(input({ canPublish: false }))[0]).toBe("Requires the Publish Exam permission");
  });

  it("names each data gap the owner locked", () => {
    expect(verifyBlockReasons(input({ officialWebsite: "  " }))).toContain("Official website is missing");
    expect(verifyBlockReasons(input({ selectionAnswered: false }))).toContain("Answer \u201CHow are candidates selected?\u201D first");
    expect(verifyBlockReasons(input({ dates: [] }))).toContain("Add at least one valid important date");
    expect(verifyBlockReasons(input({ dates: [{ date: "2026-10-25" }, { date: "2026-10-25" }] }))).toContain("Remove duplicate same-day date rows");
    expect(verifyBlockReasons(input({ hasUnsavedChanges: true }))).toContain("Save your unsaved changes first");
    expect(verifyBlockReasons(input({ name: "" }))).toContain("Exam name is empty");
    expect(verifyBlockReasons(input({ conductingBody: "" }))).toContain("Conducting body is empty");
  });

  it("unsaved changes is the LAST reason (fix the data, then save)", () => {
    const reasons = verifyBlockReasons(input({ officialWebsite: "", hasUnsavedChanges: true }));
    expect(reasons[reasons.length - 1]).toBe("Save your unsaved changes first");
  });
});

describe("needsRecheck — a FLAG, never an expiry (decision 5)", () => {
  it("flags strictly OLDER than 90 days", () => {
    const old = "2026-07-01"; // 112 days before TODAY
    const edge = "2026-07-23"; // exactly 90 days
    expect(needsRecheck(old, TODAY)).toBe(true);
    expect(needsRecheck(edge, TODAY)).toBe(false);
    expect(needsRecheck(null, TODAY)).toBe(false);
    expect(needsRecheck("2026-10-20T09:00:00Z", TODAY)).toBe(false); // timestamptz input
    expect(RECHECK_AFTER_DAYS).toBe(90);
  });
});

describe("buildQueueRow — the triage list uses the SAME rules as the control", () => {
  const qrow = (over: Partial<QueueSourceRow> = {}): QueueSourceRow => ({
    id: "1", slug: "pet", name: "UPSSSC PET", pillar: "govt-vacancy",
    conducting_body: "UPSSSC", official_website: "https://upsssc.gov.in",
    selection_model: "written-exam", is_featured: false, is_verified: false, verified_at: null,
    current_ed: { important_dates: [{ label: "Exam", date: "2026-11-01" }] },
    ...over,
  });

  it("a complete row is ready (no reasons) and computes next date + days", () => {
    const r = buildQueueRow(qrow(), TODAY);
    expect(r.reasons).toEqual([]);
    expect(r.nextDate).toBe("2026-11-01");
    expect(r.daysToNext).toBe(11);
    expect(r.hasDates).toBe(true);
    expect(r.hasOfficialUrl).toBe(true);
    expect(r.needsRecheck).toBe(false);
  });

  it("a no-dates row explains itself (the 103 entrance cases)", () => {
    const r = buildQueueRow(qrow({ current_ed: null }), TODAY);
    expect(r.reasons).toContain("Add at least one valid important date");
    expect(r.hasDates).toBe(false);
    expect(r.nextDate).toBeNull();
  });

  it("permission/unsaved reasons are the EDITOR's context — never the list's", () => {
    const r = buildQueueRow(qrow(), TODAY);
    expect(r.reasons.join(" ")).not.toContain("Publish Exam permission");
    expect(r.reasons.join(" ")).not.toContain("unsaved");
  });

  it("an old verification arrives as a re-check row WITH its date (decision 4)", () => {
    const r = buildQueueRow(qrow({ is_verified: true, verified_at: "2026-06-01T10:00:00Z" }), TODAY);
    expect(r.verifiedAt).toBe("2026-06-01T10:00:00Z");
    expect(r.needsRecheck).toBe(true);
  });

  it("is_verified=false clears the stamp view even when verified_at lingers", () => {
    const r = buildQueueRow(qrow({ is_verified: false, verified_at: "2026-06-01" }), TODAY);
    expect(r.verifiedAt).toBeNull();
    expect(r.needsRecheck).toBe(false);
  });
});

describe("sortQueueRows — nearest upcoming first, no-date last, featured breaks ties", () => {
  const row = (slug: string, nextDate: string | null, isFeatured = false) => ({
    ...buildQueueRow({ id: slug, slug, name: slug, pillar: "govt-vacancy", is_featured: isFeatured, current_ed: nextDate ? { important_dates: [{ date: nextDate }] } : null }, TODAY),
    nextDate,
  });

  it("orders by date, sinks nulls, featured-first on ties", () => {
    const sorted = sortQueueRows([row("c", null), row("a", "2026-11-05"), row("b", "2026-11-02"), row("d", "2026-11-05", true)]);
    // b is soonest; d and a share 05-Nov with d featured first; c has no date.
    expect(sorted.map((r) => r.slug)).toEqual(["b", "d", "a", "c"]);
  });
});
