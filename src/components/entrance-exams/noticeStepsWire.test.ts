/**
 * B2 (client) — wiring the deterministic how-to steps into the review drawer.
 *
 * Pinned here:
 *  • buildNoticeResult attaches result.steps straight from the PASTED text (the
 *    detector, never the model) — a flaky model cannot drop the how-to block.
 *  • buildReviewRows maps each step / carry line to an editable review row that
 *    starts UNCHECKED (never auto-applied), carries its verbatim source line, and
 *    targets the right module by kind: admit-card → admit-card.steps/carry,
 *    application how-to → application-process.steps.
 *  • the drawer renders a step as an EDITABLE input beside its source quote, and
 *    the editor's Apply STAGES the accepted steps into pending module edits — it
 *    never writes the DB (R1.6: the editor saves).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReviewRows, summarizeFill, type ReviewCurrentValues, type CategoryLookup } from "./noticeReview";
import { buildNoticeResult } from "@/lib/ai/noticeResult";
import type { PipelineResult } from "@/lib/ai/noticePipeline";
import type { AllowedOptions } from "@/lib/ai/extractionContract";

const categories: CategoryLookup[] = [{ slug: "state-government-jobs", id: "cat-sgj", name: "State Government Jobs" }];
const emptyCurrent: ReviewCurrentValues = {};

/** A PipelineResult with only the given how-to blocks (everything else minimal). */
const resultWithSteps = (steps: PipelineResult["steps"]): PipelineResult =>
  ({ fields: {}, rows: [], references: [], rejected: [], warnings: [], mergedWindows: [], steps });

const ADMIT_HOWTO: NonNullable<PipelineResult["steps"]> = [
  {
    module: "admit-card",
    heading: "How to download UPSSSC PET admit card",
    steps: [
      { text: "Visit the official UPSSSC website", sourceQuote: "Visit the official UPSSSC website" },
      { text: "Enter registration number and date of birth", sourceQuote: "Enter registration number and date of birth" },
    ],
    carry: [
      { text: "Valid photo ID", sourceQuote: "Valid photo ID" },
    ],
  },
];

describe("B2 — buildReviewRows maps how-to steps to editable, uncheck-by-default rows", () => {
  const rows = buildReviewRows(resultWithSteps(ADMIT_HOWTO), emptyCurrent, categories, { isNew: false });

  it("produces one row per step AND per carry line, kind === 'step'", () => {
    const stepRows = rows.filter((r) => r.kind === "step");
    expect(stepRows).toHaveLength(3); // 2 steps + 1 carry
  });

  it("every step row starts UNCHECKED (never auto-applied) even at confidence 1", () => {
    for (const r of rows.filter((x) => x.kind === "step")) {
      expect(r.defaultAccept, r.label).toBe(false);
      expect(r.confidence).toBe(1); // attested source line, but that never pre-checks it
    }
  });

  it("each step row keeps its verbatim source line beside the proposed text", () => {
    const first = rows.find((r) => r.id === "step:admit-card:steps:0");
    expect(first?.proposed).toBe("Visit the official UPSSSC website");
    expect(first?.sourceQuote).toBe("Visit the official UPSSSC website");
  });

  it("targets the module by kind — admit-card steps/carry", () => {
    expect(rows.find((r) => r.id === "step:admit-card:steps:0")?.stepTarget)
      .toEqual({ module: "admit-card", field: "steps", order: 0 });
    expect(rows.find((r) => r.id === "step:admit-card:carry:0")?.stepTarget)
      .toEqual({ module: "admit-card", field: "carry", order: 0 });
  });

  it("an application how-to targets application-process.steps", () => {
    const applyRows = buildReviewRows(
      resultWithSteps([{ module: "application-process", heading: "How to apply", steps: [{ text: "Fill the form", sourceQuote: "Fill the form" }], carry: [] }]),
      emptyCurrent, categories, { isNew: false },
    );
    expect(applyRows.find((r) => r.kind === "step")?.stepTarget)
      .toEqual({ module: "application-process", field: "steps", order: 0 });
  });

  it("no steps → no step rows (sparse notice renders nothing extra)", () => {
    const none = buildReviewRows(resultWithSteps(undefined), emptyCurrent, categories, { isNew: false });
    expect(none.filter((r) => r.kind === "step")).toHaveLength(0);
  });

  it("summarizeFill counts steps as needing a deliberate decision, never 'no field yet'", () => {
    const report = summarizeFill(rows, [], resultWithSteps(ADMIT_HOWTO));
    expect(rows.filter((r) => r.kind === "step").every((r) => !r.noFieldYet)).toBe(true);
    // 3 step rows are not default-accepted → they land in the flagged/decision count
    expect(report.proposed).toBeGreaterThanOrEqual(3);
  });
});

describe("B2 — buildNoticeResult attaches steps from the pasted text (detector, not model)", () => {
  const allowed: AllowedOptions = {
    categories: [{ slug: "state-government-jobs", name: "State Government Jobs" }],
    regions: [{ slug: "uttar-pradesh", label: "Uttar Pradesh" }],
    entityTypes: ["exam"],
    selectionModels: ["written-exam"],
  };
  const notice = [
    "UPSSSC PET Admit Card 2026",
    "How to download admit card:",
    "Visit the official website upsssc.gov.in",
    "Login with registration number and date of birth",
    "Documents to carry:",
    "Valid photo ID",
  ].join("\n");

  it("the empty model answer still yields the how-to steps from the paste", () => {
    const result = buildNoticeResult({ fields: {}, dates: [] }, allowed, notice, 2026, "written-exam");
    expect(result.steps?.length).toBeGreaterThan(0);
    expect(result.steps?.[0].module).toBe("admit-card");
    expect(result.steps?.[0].steps.map((s) => s.text)).toContain("Visit the official website upsssc.gov.in");
  });

  it("a notice with no how-to block carries no steps key (byte-identical to before)", () => {
    const result = buildNoticeResult({ fields: {}, dates: [] }, allowed, "Important Dates\nExam: 25 Oct 2026", 2026, "written-exam");
    expect(result.steps).toBeUndefined();
  });
});

describe("B2 — the drawer + editor really wire the steps (guards against a dead prop)", () => {
  const drawer = readFileSync(resolve(__dirname, "NoticeReviewDrawer.tsx"), "utf8");
  const page = readFileSync(resolve(__dirname, "../../pages/entrance-exams/EntranceExamEditorPage.tsx"), "utf8");

  it("the drawer renders an editable input for a step row (not a static label)", () => {
    expect(drawer).toContain("r.kind === \"step\"");
    expect(drawer).toContain("drawer-step-input-");
    expect(drawer).toContain("setStepEdits");
  });

  it("the drawer sends the edited step text through to Apply", () => {
    expect(drawer).toMatch(/stepEdits\[r\.id\]\s*\?\?\s*r\.proposed/);
  });

  it("the editor Apply handles kind === 'step' by staging module edits, never a DB write", () => {
    expect(page).toContain("r.kind === \"step\" && r.stepTarget");
    expect(page).toContain("pendingModuleEditsRef");
    // steps land on Save through the merged content_modules, not on Apply
    expect(page).toContain("withPendingModuleEdits");
  });
});
