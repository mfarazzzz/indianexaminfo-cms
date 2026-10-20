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
import { extractNoticeDateLines, planDateMerge, type ExistingRow } from "./noticeDateLines";
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

// ── C1: the SAME notice with the FULL aggregator chrome around it ───────────
// The 20-Oct page carries a different, heavier chrome (trending/related lists,
// a "Post Date / Update" line, dated titles like "Shillong TEER Result (20
// October 2026)"). None of that may become a dated row — only the Important
// Dates block and the header exam-date line are date sources.
const chromeText = readFileSync(FIX("pasted.chrome.txt"), "utf8");
const chrome = extractNoticeDateLines(chromeText, 2026, "written-exam");
const CHROME_MARKERS = ["Shillong", "JRHMS", "CDS-II", "Bihar STET", "RRB JE", "SBI PO", "UP Police", "Copyright", "Post Title", "Post Date", "SUBSCRIBE", "NDA II Result", "Exam Name", "Conducting Body"];

describe("S2.15 C1: aggregator chrome never becomes a date row", () => {
  it("still lands exactly the three exam dates + city + admit card, nothing from chrome", () => {
    expect(chrome.rows.filter((r) => r.type === "exam_written").map((r) => r.date).sort())
      .toEqual(["2026-10-25", "2026-10-30", "2026-11-01"]);
    expect(chrome.rows.find((r) => r.date === "2026-10-12")?.type).toBe("exam_city_intimation");
    expect(chrome.rows.find((r) => r.date === "2026-10-17")?.type).toBe("admit_card");
  });

  it("no row's source line is chrome (trending / related / post-date / footer)", () => {
    for (const r of chrome.rows) {
      for (const marker of CHROME_MARKERS) {
        expect(r.source_quote, `chrome leaked: ${marker} in "${r.source_quote}"`).not.toContain(marker);
      }
    }
  });

  it("the 'Post Date / Update: 17 October 2026' issue line is never a dated row", () => {
    expect(chrome.rows.some((r) => r.source_quote.includes("Post Date"))).toBe(false);
    // 17 Oct exists ONLY as the admit-card line, never a second issue-date row.
    expect(chrome.rows.filter((r) => r.date === "2026-10-17")).toHaveLength(1);
  });

  it("relative lines are still notes even amid the heavier chrome", () => {
    const texts = chrome.notes.map((n) => n.text);
    expect(texts).toContain("Answer Key Available: After Exam");
    expect(texts).toContain("Status: Exam Date Out");
  });
});

// ── C2: the REAL current UPSSSC PET edition rows (owner hand-fixing by hand) ──
// Live rows today: 6 Oct exam_physical (system seed), 12 Oct other, 17 Oct
// admit_card, 25 Oct exam_written, 30 Oct exam_written. Re-running the notice
// must: treat 25/30 Oct as already-present, add ONLY 1 Nov as a new exam row,
// flag the stale 6 Oct physical as a supersede candidate (default-checked,
// system-seeded), NOT duplicate the admit card, and propose no identity change.
// Once applied (6 Oct gone, exam window 25 Oct→1 Nov, admit card 17 Oct ≤ today
// < exam start) exam_derived_status reads ADMIT-CARD-OUT.
const petExisting: ExistingRow[] = [
  { label: "PET Exam", date: "2026-10-06", type: "exam_physical", verified: false },
  { label: "Exam City Details Out Date", date: "2026-10-12", type: "other", verified: false },
  { label: "Admit Card Available", date: "2026-10-17", type: "admit_card", verified: false },
  { label: "Exam Dates", date: "2026-10-25", type: "exam_written", verified: false },
  { label: "Revised PET Written Exam Dates", date: "2026-10-30", type: "exam_written", verified: false },
];
const det = extractNoticeDateLines(pastedText, 2026, "written-exam").rows;
const plan = planDateMerge(petExisting, det);

describe("S2.15 C2: the real PET edition — merge plan against existing rows", () => {
  it("25 and 30 Oct are already-present (no-change), not re-added", () => {
    const already = plan.alreadyPresent.filter((r) => r.type === "exam_written").map((r) => r.date).sort();
    expect(already).toEqual(["2026-10-25", "2026-10-30"]);
  });

  it("1 Nov is the ONLY new exam row (addCustom)", () => {
    expect(plan.addCustom.filter((r) => r.type === "exam_written").map((r) => r.date)).toEqual(["2026-11-01"]);
  });

  it("the admit card is NOT duplicated (17 Oct already present)", () => {
    expect(plan.addCustom.some((r) => r.type === "admit_card")).toBe(false);
    expect(plan.alreadyPresent.some((r) => r.type === "admit_card" && r.date === "2026-10-17")).toBe(true);
  });

  it("the stale 6 Oct system-seeded physical row is a supersede candidate, default-checked", () => {
    expect(plan.supersede).toHaveLength(1);
    expect(plan.supersede[0].row.date).toBe("2026-10-06");
    expect(plan.supersede[0].defaultRemove).toBe(true);
    expect(plan.supersede[0].replacedBy).toContain("2026-11-01");
  });

  it("no identity change is proposed on the existing record", () => {
    const rows = buildReviewRows(result, current, categories, { isNew: false });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.name?.noChange).toBe(true);
    expect(byId.shortName?.noChange).toBe(true);
  });
});
