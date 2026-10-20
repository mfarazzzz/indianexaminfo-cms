/**
 * S2.15 golden — the UPSSSC PET 17-Oct-2026 admit-card notice, the exact paste
 * that exposed the flaky-model failure. Offline, deterministic, no live call.
 *
 * The model answer (model.responses.json) is DELIBERATELY flaky: it returns
 * only ONE exam date (30 Oct — the middle one the real groq answer produced).
 * buildNoticeResult must still land all THREE exam dates because the
 * deterministic date-line parser reads them straight from the pasted text.
 *
 * Pinned here:
 *  • three exam_written rows (25, 30 Oct, 1 Nov); exam city 12 Oct; admit card 17 Oct;
 *  • the header "Exam Dates: 23, 24 & 25 October" is NOT proposed and a visible
 *    conflict warning explains the override (2b);
 *  • "After Exam" / "Exam Date Out" are notes, never dated rows;
 *  • six link labels with no URL in a PLAIN paste are dropped; the same six are
 *    attested when the paste carried HTML anchors;
 *  • identity (name/short name/category/region/selection/website) is a no-change
 *    on the existing record — nothing re-dates the evergreen identity (2e).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildNoticeResult } from "./noticeResult";
import { extractAnchors } from "./noticePaste";
import { buildReviewRows, type ReviewCurrentValues, type CategoryLookup } from "@/components/entrance-exams/noticeReview";
import type { AllowedOptions } from "./extractionContract";

const FIX = (name: string) => resolve(__dirname, `./__fixtures__/upsssc-pet-2026/${name}`);
const pastedText = readFileSync(FIX("pasted.txt"), "utf8");
const pastedHtml = readFileSync(FIX("pasted.html"), "utf8");
const recording = JSON.parse(readFileSync(FIX("model.responses.json"), "utf8")) as { answer: Record<string, unknown> };

const allowed: AllowedOptions = {
  categories: [{ slug: "state-government-jobs", name: "State Government Jobs" }],
  regions: [{ slug: "uttar-pradesh", label: "Uttar Pradesh" }],
  entityTypes: ["recruitment", "exam"],
  selectionModels: ["written-exam", "merit-based", "interview-based"],
};

// The record as it stands today (the owner's hand-fixed identity) — everything
// the model re-proposes should collapse to no-change.
const current: ReviewCurrentValues = {
  name: "UPSSSC PET (Preliminary Eligibility Test)",
  shortName: "UPSSSC PET",
  conductingBody: "UP Subordinate Services Selection Commission",
  officialWebsite: "https://upsssc.gov.in",
  region: "uttar-pradesh",
  categoryId: "cat-sgj",
  selectionModel: "written-exam",
};
const categories: CategoryLookup[] = [{ slug: "state-government-jobs", id: "cat-sgj", name: "State Government Jobs" }];

const result = buildNoticeResult(recording.answer, allowed, pastedText, 2026, "written-exam");

describe("S2.15 golden: flaky model still yields every Important-Dates line", () => {
  it("the model returned ONE exam date; the result has all THREE exam_written rows", () => {
    const exam = result.rows.filter((r) => r.type === "exam_written").map((r) => r.date).sort();
    expect(exam).toEqual(["2026-10-25", "2026-10-30", "2026-11-01"]);
    // the two extra dates are the deterministic rows the model dropped
    expect(result.rows.filter((r) => r.type === "exam_written" && r.source === "notice-line")).toHaveLength(3);
  });

  it("exam city (12 Oct) and admit card (17 Oct) become their own typed rows", () => {
    expect(result.rows.find((r) => r.date === "2026-10-12")?.type).toBe("exam_city_intimation");
    expect(result.rows.find((r) => r.date === "2026-10-17")?.type).toBe("admit_card");
  });

  it("the header 23/24 Oct is NOT proposed and the conflict is surfaced, not silent", () => {
    expect(result.rows.some((r) => r.date === "2026-10-23" || r.date === "2026-10-24")).toBe(false);
    expect((result.dateConflicts ?? []).length).toBeGreaterThan(0);
    expect(result.dateConflicts!.join(" ")).toMatch(/Exam Dates/);
    expect(result.dateConflicts!.join(" ")).toMatch(/Revised PET Written Exam Dates/);
  });

  it("relative lines are notes, never dated rows", () => {
    const texts = (result.notes ?? []).map((n) => n.text);
    expect(texts).toContain("Answer Key Available: After Exam");
    expect(texts).toContain("Status: Exam Date Out");
    expect(result.rows.some((r) => r.type === "answer_key")).toBe(false);
  });

  it("a PLAIN paste carries no URLs → none of the six link labels survive", () => {
    expect(result.importantLinks ?? []).toHaveLength(0);
  });

  it("the same paste as HTML attests all six link labels", () => {
    const anchors = extractAnchors(pastedHtml);
    expect(anchors).toHaveLength(6);
    const withHtml = buildNoticeResult(recording.answer, allowed, pastedHtml, 2026, "written-exam", anchors);
    expect(withHtml.importantLinks ?? []).toHaveLength(6);
  });

  it("identity/classification on the existing record is a no-change (2e)", () => {
    const rows = buildReviewRows(result, current, categories, { isNew: false });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    for (const id of ["name", "shortName", "region", "selectionModel", "categorySlug", "officialWebsite"]) {
      expect(byId[id]?.noChange, `${id} should be a no-change`).toBe(true);
    }
    // and a no-change is never offered as a decision
    expect(byId.shortName.defaultAccept).toBe(false);
  });
});
