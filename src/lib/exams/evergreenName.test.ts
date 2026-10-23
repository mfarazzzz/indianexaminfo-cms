/**
 * evergreenName.test.ts — pins the "name ends with a year" rule.
 *
 * The rule MUST stay identical to the December batch migration's
 * `(20[0-9]{2})\s*$` (supabase/proposed/evergreen_names_DRYRUN.sql): it lights on a
 * trailing 20YY only — not a 19YY, not a year mid-string, not a year range — so the
 * editor's hint and the future batch agree on exactly which names carry a year.
 */
import { describe, it, expect } from "vitest";
import { nameEndsWithYear, stripTrailingYear } from "./evergreenName";

describe("nameEndsWithYear — the evergreen rule (20YY at the end)", () => {
  it("lights on a real trailing edition year", () => {
    expect(nameEndsWithYear("IBPS PO 2025")).toBe(true);
    expect(nameEndsWithYear("SSC CGL Recruitment 2026")).toBe(true);
    expect(nameEndsWithYear("UP Board Class 12 2020")).toBe(true);
    expect(nameEndsWithYear("NDA 2099")).toBe(true);
  });

  it("allows trailing whitespace (what an editor actually types)", () => {
    expect(nameEndsWithYear("CAT 2026   ")).toBe(true);
  });

  it("stays dark on everything that is NOT a trailing 20YY", () => {
    expect(nameEndsWithYear("NDA Exam")).toBe(false);
    expect(nameEndsWithYear("CAT")).toBe(false);
    expect(nameEndsWithYear("UP Board 2025 Class 10")).toBe(false); // year mid-string
    expect(nameEndsWithYear("UPSSSC PET 2026-27")).toBe(false);     // a range, not a bare year
    expect(nameEndsWithYear("Session 1999")).toBe(false);           // 19YY is out of scope
    expect(nameEndsWithYear("Century 2100")).toBe(false);           // 21YY is out of scope
    expect(nameEndsWithYear("Roll 12345")).toBe(false);             // not a year token
    expect(nameEndsWithYear("")).toBe(false);
    expect(nameEndsWithYear(null)).toBe(false);
    expect(nameEndsWithYear(undefined)).toBe(false);
  });
});

describe("stripTrailingYear — mirrors the migration's regexp_replace", () => {
  it("removes the trailing year and its whitespace", () => {
    expect(stripTrailingYear("IBPS PO 2025")).toBe("IBPS PO");
    expect(stripTrailingYear("UPSSSC PET 2026  ")).toBe("UPSSSC PET");
  });
  it("leaves an evergreen name untouched", () => {
    expect(stripTrailingYear("NDA Exam")).toBe("NDA Exam");
    expect(stripTrailingYear("UP Board 2025 Class 10")).toBe("UP Board 2025 Class 10");
  });
});
