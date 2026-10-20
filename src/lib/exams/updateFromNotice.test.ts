/**
 * updateFromNotice.test.ts — D-P2 prefill: a notice becomes a DRAFT update with
 * only attested facts (never prose), a content_type from the dominant event, and
 * the important-links carried over. Body stays empty for the editor.
 */
import { describe, it, expect } from "vitest";
import { contentTypeFromNotice, linksFromNotice, buildUpdateDraftFromNotice } from "./updateFromNotice";
import type { PipelineResult } from "@/lib/ai/noticePipeline";

const pr = (over: Partial<PipelineResult>): PipelineResult => ({
  fields: {}, rows: [], references: [], rejected: [], warnings: [], mergedWindows: [], ...over,
});

describe("contentTypeFromNotice", () => {
  it("maps the dominant event to a content_type", () => {
    expect(contentTypeFromNotice(pr({ rows: [{ type: "admit_card" } as never] }))).toBe("admit-card");
    expect(contentTypeFromNotice(pr({ rows: [{ type: "result" } as never] }))).toBe("result");
    expect(contentTypeFromNotice(pr({ rows: [{ type: "application_end" } as never] }))).toBe("application");
    expect(contentTypeFromNotice(pr({ rows: [] }))).toBe("notification");
  });
});

describe("buildUpdateDraftFromNotice", () => {
  const result = pr({
    fields: { name: { value: "UPSSSC PET (Preliminary Eligibility Test)", confidence: 1, sourceQuote: "q", flagged: false } },
    rows: [
      { label: "Admit Card Available", date: "2026-10-17", type: "admit_card", kind: "admit_card", isUrgent: false } as never,
    ],
    importantLinks: [{ label: "Download Admit Card", url: "https://upsssc.gov.in/admit", kind: "admit_card" }],
  });
  const draft = buildUpdateDraftFromNotice(result, { examId: "ex1", examEditionId: "ed1", slug: "pet-admit", pillar: "government-exam" });

  it("is a DRAFT with an empty body (editor writes the words)", () => {
    expect(draft.status).toBe("draft");
    expect(draft.body).toBe("");
    expect(draft.kind).toBe("provisional");
  });

  it("links the exam + edition and derives content_type from the notice", () => {
    expect(draft.examId).toBe("ex1");
    expect(draft.examEditionId).toBe("ed1");
    expect(draft.contentType).toBe("admit-card");
  });

  it("carries ONLY the attested link as a quick link", () => {
    expect(linksFromNotice(result)).toEqual([{ label: "Download Admit Card", url: "https://upsssc.gov.in/admit" }]);
    expect(draft.quickLinks).toHaveLength(1);
  });

  it("falls back to a safe title when the notice has no name", () => {
    const d = buildUpdateDraftFromNotice(pr({}), { examId: "ex1", slug: "s" });
    expect(d.title).toBe("Notice update");
  });
});
