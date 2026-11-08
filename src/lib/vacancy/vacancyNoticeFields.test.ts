/**
 * vacancyNoticeFields.test.ts — the deterministic extractors, pinned against a
 * realistic pasted notice. Every rule the owner approved is asserted here:
 * a source line for every proposal, no invented dates, no copied wording.
 */
import { describe, it, expect } from "vitest";
import {
  extractVacancyFields,
  classifyVacancyDateLabel,
  guardWording,
  type VacancyProposal,
} from "./vacancyNoticeFields";

const NOTICE = `Uttar Pradesh Police Constable Recruitment 2026

The Staff Selection Commission has published the notice for Constable (GD).

Important Dates:
Notification Date: 12.08.2026
Online Application Starts: 20.08.2026
Last Date to Apply: 15.09.2026
Fee Payment Last Date: 10.09.2026

Total No. of Posts: 5,244

Application Fee:
General/OBC: Rs 100/-
SC/ST/PwBD: Rs 0/-

Age Limit: 18-32 years as on 01.01.2026
`;

function byField(proposals: VacancyProposal[], field: string) {
  return proposals.find((p) => p.field === field);
}

describe("extractVacancyFields — the three window dates", () => {
  const out = extractVacancyFields(NOTICE, { year: 2026 });

  it("proposes the notification date with its SOURCE LINE", () => {
    const p = byField(out.proposals, "notificationDate");
    expect(p?.value).toBe("2026-08-12");
    expect(p?.sourceLine).toBe("Notification Date: 12.08.2026");
  });

  it("proposes the application start date with its SOURCE LINE", () => {
    const p = byField(out.proposals, "applicationStartDate");
    expect(p?.value).toBe("2026-08-20");
    expect(p?.sourceLine).toBe("Online Application Starts: 20.08.2026");
  });

  it("proposes the last date to apply with its SOURCE LINE", () => {
    const p = byField(out.proposals, "applicationEndDate");
    expect(p?.value).toBe("2026-09-15");
    expect(p?.sourceLine).toBe("Last Date to Apply: 15.09.2026");
  });

  it("NEVER uses the fee-payment deadline as the application end date", () => {
    const p = byField(out.proposals, "applicationEndDate");
    expect(p?.value).not.toBe("2026-09-10");
    expect(out.proposals.some((x) => x.value === "2026-09-10")).toBe(false);
  });

  it("never invents a date that is not in the notice", () => {
    const dates = out.proposals
      .filter((p) => p.kind === "date")
      .map((p) => p.value);
    expect(dates).toEqual(["2026-08-12", "2026-08-20", "2026-09-15"]);
  });
});

describe("extractVacancyFields — count, fee, age", () => {
  const out = extractVacancyFields(NOTICE, { year: 2026 });

  it("proposes the vacancy count from the notice's own number", () => {
    const p = byField(out.proposals, "vacancyCount");
    expect(p?.value).toBe(5244);
    expect(p?.sourceLine).toBe("Total No. of Posts: 5,244");
  });

  it("reads the count from a 'Vacancies: N' line (the label our OWN rows use)", () => {
    // The count regex had a `\b` AFTER a punctuation branch, so "Vacancies: 750"
    // could never match — the count was silently dropped for every notice written
    // that way (the shape of the 361 imported rows' own text).
    const notice = `Rajasthan Police Driver Bharti 2026
Vacancies: 750
Age: 20-27 years`;
    const out = extractVacancyFields(notice, { year: 2026 });
    const p = byField(out.proposals, "vacancyCount");
    expect(p?.value).toBe(750);
    expect(p?.sourceLine).toBe("Vacancies: 750");
  });

  it("still refuses a 'Vacancies:' line that carries no number", () => {
    const notice = `Vacancies: To be notified later
Total No. of Posts: 100`;
    const out = extractVacancyFields(notice, { year: 2026 });
    expect(byField(out.proposals, "vacancyCount")?.value).toBe(100);
  });

  it("proposes the fee as category → amount pairs, not as the notice's wording", () => {
    const p = byField(out.proposals, "applicationFee");
    expect(p?.value).toEqual({ "General/OBC": "100", "SC/ST/PwBD": "0" });
    expect(p?.sourceLine).toContain("General/OBC");
  });

  it("proposes the age limit as a composed range", () => {
    const p = byField(out.proposals, "ageLimit");
    expect(p?.value).toBe("18-32 years");
    expect(p?.sourceLine).toBe("Age Limit: 18-32 years as on 01.01.2026");
  });

  it("marks dates, counts and composed values as data (the guard's recorded verdict)", () => {
    for (const f of ["notificationDate", "vacancyCount", "applicationFee", "ageLimit"]) {
      expect(byField(out.proposals, f)?.guard).toBe("data");
    }
  });
});

describe("extractVacancyFields — the copy guard", () => {
  it("proposes the title as a document NAME (exempt, with its source line)", () => {
    const out = extractVacancyFields(NOTICE, { year: 2026 });
    const p = byField(out.proposals, "title");
    expect(p?.value).toBe("Uttar Pradesh Police Constable Recruitment 2026");
    expect(p?.guard).toBe("name-exempt");
  });

  it("REFUSES an organisation string that is the notice's own long wording", () => {
    const notice = `Organisation: Uttar Pradesh Police Department Office of the Superintendent of Police Lucknow
Total No. of Posts: 100`;
    const out = extractVacancyFields(notice, { year: 2026 });
    const p = byField(out.proposals, "organization");
    expect(p?.guard).toBe("refused");
    expect(p?.value).toBeNull();
    expect(p?.refused).toMatch(/own words/i);
  });

  it("proposes a SHORT organisation name (a proper name is exempt)", () => {
    const out = extractVacancyFields(NOTICE, { year: 2026 });
    // No "Organisation:" line in the fixture and no leading acronym run in the
    // title → nothing is proposed. Nothing is invented.
    expect(byField(out.proposals, "organization")).toBeUndefined();
  });

  it("guardWording passes a short name and refuses a copied sentence", () => {
    expect(guardWording("SSC", "Organisation: SSC").verdict).toBe("name-exempt");
    expect(
      guardWording(
        "Office of the Superintendent of Police Lucknow",
        "Organisation: Office of the Superintendent of Police Lucknow",
      ).verdict,
    ).toBe("refused");
  });
});

describe("extractVacancyFields — relative dates and notes", () => {
  it("records a relative date as a NOTE, never as a date", () => {
    const notice = `Last Date to Apply: To be notified later
Notification Date: 01.09.2026`;
    const out = extractVacancyFields(notice, { year: 2026 });
    const p = byField(out.proposals, "applicationEndDate");
    expect(p).toBeUndefined();
    expect(out.notes.join(" ")).toMatch(/to be notified/i);
  });
});

describe("classifyVacancyDateLabel", () => {
  it.each([
    ["Notification Date", "notification"],
    ["Notification Issued On", "notification"],
    ["Online Application Starts", "application_start"],
    ["Application Start Date", "application_start"],
    ["Last Date to Apply", "application_end"],
    ["Closing Date", "application_end"],
    ["Application End Date", "application_end"],
  ])("classifies %s as %s", (label, slot) => {
    expect(classifyVacancyDateLabel(label)).toBe(slot);
  });

  it("refuses a fee deadline and the notice's own issue line", () => {
    expect(classifyVacancyDateLabel("Fee Payment Last Date")).toBeNull();
    expect(classifyVacancyDateLabel("Post Date")).toBeNull();
    expect(classifyVacancyDateLabel("Total No. of Posts")).toBeNull();
  });
});
