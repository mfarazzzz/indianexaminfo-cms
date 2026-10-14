/**
 * S2.14b golden test — the RRB NTPC 2026 Graduate Level recruitment notice,
 * routed through an AGGREGATOR-style page (the owner confirmed aggregator
 * pages carry all the facts we want; we extract facts, never their prose).
 *
 * FIXTURES (src/lib/ai/__fixtures__/rrb-ntpc-2026/):
 *   pasted.txt            — the chrome-trimmed source the editor would paste.
 *                           Contains both attested URLs (rrbapply.gov.in/ntpc,
 *                           rrbcdg.gov.in/) and NOT the invented evil.example.
 *   model.responses.json  — a HAND-WRITTEN v8 answer carrying the NEW optional
 *                           fields (vacancy {total,posts[]}, important_links[]
 *                           with one URL nowhere in the source, notes[] with a
 *                           TBN exam line and an admit-card-relative line).
 *                           Every sourceQuote/dateText is a verbatim line of
 *                           pasted.txt; realistic, not a copy of expected.json.
 *   expected.json         — the acceptance table for the S2.14b contract.
 *
 * DETERMINISTIC CI PATH: postProcessExtraction() — the SAME single authority
 * the editor uses — must turn the hand-written answer into expected.json. No
 * network, no live call. This is the client-only Stage 1 (no ai-fill change).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { postProcessExtraction, runNoticePipeline } from "./noticePipeline";
import type { AllowedOptions } from "./extractionContract";

const FIX = (name: string) => resolve(__dirname, `./__fixtures__/rrb-ntpc-2026/${name}`);

const pastedText = readFileSync(FIX("pasted.txt"), "utf8");
const recording = JSON.parse(readFileSync(FIX("model.responses.json"), "utf8")) as { answer: Record<string, unknown> };
const expected = JSON.parse(readFileSync(FIX("expected.json"), "utf8"));

/** Allowed options a live call would read (mirrors the real lists: railways
 *  exists, all-india exists, recruitment / written-exam choices exist). */
const allowed: AllowedOptions = {
  categories: [
    { slug: "railways", name: "Railways" },
    { slug: "banks", name: "Banks" },
    { slug: "ssb-defence", name: "SSC / Defence" },
  ],
  regions: [
    { slug: "all-india", label: "All India" },
    { slug: "up", label: "Uttar Pradesh" },
  ],
  entityTypes: ["recruitment", "exam", "result"],
  selectionModels: ["written-exam", "merit-based", "interview-based"],
};

const result = postProcessExtraction(recording.answer, allowed, pastedText, 2026, null);

describe("golden: RRB NTPC 2026 — two-row registration contract (S2.14b)", () => {
  it("emits exactly the three rows expected.json defines (start + end stay TWO rows, fee separate)", () => {
    const shape = result.rows.map((r) => ({ label: r.label, type: r.type, kind: r.kind, date: r.date, state: r.state, isUrgent: r.isUrgent }));
    expect(shape).toEqual(expected.dates);
  });

  it("the registration window is NEVER merged — mergedWindows stays empty", () => {
    expect(result.mergedWindows).toEqual(expected.mergedWindows);
    expect(result.rows.some((r) => r.kind === "registration_start" && r.date === "2026-10-08")).toBe(true);
    expect(result.rows.some((r) => r.kind === "registration_end" && r.date === "2026-11-06")).toBe(true);
    expect(result.rows.some((r) => r.type === "application_end")).toBe(true);
  });

  it("a fee deadline on the SAME date as the registration end does not collapse into it", () => {
    const fee = result.rows.find((r) => r.kind === "fee_last_date");
    expect(fee?.date).toBe("2026-11-06");
    expect(fee?.type).toBe("other");
  });
});

describe("golden: RRB NTPC 2026 — new optional fields (S2.14b)", () => {
  it("vacancy carries the real total and the post-wise rows, never an invented number", () => {
    expect(result.vacancy).toBeTruthy();
    expect(result.vacancy!.total).toBe(expected.vacancy.total);
    expect(result.vacancy!.posts).toHaveLength(expected.vacancy.postCount);
    // Counts come straight from the answer; none fabricated to fill a gap.
    for (const p of result.vacancy!.posts) expect(p.name).not.toBe("");
  });

  it("important_links keeps ONLY the source-attested URLs and drops the invented one", () => {
    const urls = (result.importantLinks ?? []).map((l) => l.url);
    for (const kept of expected.importantLinks.keptUrls) {
      expect(urls, `attested URL ${kept} was wrongly dropped`).toContain(kept);
    }
    expect(urls, "an un-attested URL must never survive").not.toContain(expected.importantLinks.droppedUrl);
    expect(result.importantLinks).toHaveLength(expected.importantLinks.keptUrls.length);
  });

  it("a link attested ONLY by an HTML anchor (not in the text) is accepted when anchors are passed", () => {
    const withAnchor = postProcessExtraction(recording.answer, allowed, pastedText, 2026, null, [
      { label: "Scholarship Portal", url: expected.importantLinks.droppedUrl },
    ]);
    const urls = (withAnchor.importantLinks ?? []).map((l) => l.url);
    expect(urls).toContain(expected.importantLinks.droppedUrl);
  });

  it("notes[] hold the TBN / relative exam lines as TEXT — never as dated rows", () => {
    expect(result.notes).toBeTruthy();
    expect(result.notes).toHaveLength(expected.notes.count);
    expect(result.notes!.map((n) => n.text)).toEqual(expected.notes.texts);
    for (const banned of expected.noDatedRowKinds) {
      expect(result.rows.some((r) => r.kind === banned), `a dated ${banned} row leaked`).toBe(false);
      expect(result.rows.some((r) => r.type === banned), `a dated ${banned} type leaked`).toBe(false);
    }
  });
});

describe("golden: RRB NTPC 2026 — fields, quotes, safety (S2.14b)", () => {
  it("the core field proposals survive with verbatim quotes (nothing flagged for a made-up quote)", () => {
    expect(result.fields.name.value).toContain("RRB NTPC");
    expect(result.fields.conductingBody.value).toBe("Railway Recruitment Board (RRB)");
    expect(result.fields.noticeReference.value).toBe("Advt No : CEN 06/2026");
    for (const [name, field] of Object.entries(result.fields)) {
      if (field.sourceQuote) {
        expect(field.flagged, `field ${name} flagged: ${field.flagReason}`).toBe(false);
      }
    }
  });

  it("option fields resolve to real slugs, not UUIDs", () => {
    expect(result.fields.categorySlug.value).toBe("railways");
    expect(result.fields.categorySlug.flagged).toBe(false);
    expect(result.fields.selectionModel.value).toBe("written-exam");
    expect(result.fields.entityType.value).toBe("recruitment");
    expect(result.fields.region.value).toBe("all-india");
  });
});

describe("golden: RRB NTPC 2026 — backward compatibility (pre-v8 answer)", () => {
  it("an answer WITHOUT the new fields yields a result with NO vacancy/importantLinks/notes keys", () => {
    const legacyAnswer = {
      fields: recording.answer.fields,
      dates: recording.answer.dates,
      references: [],
    };
    const legacy = postProcessExtraction(legacyAnswer, allowed, pastedText, 2026, null);
    expect("vacancy" in legacy).toBe(false);
    expect("importantLinks" in legacy).toBe(false);
    expect("notes" in legacy).toBe(false);
    // The date/field output is unchanged by the new code paths.
    const legacyShape = legacy.rows.map((r) => ({ label: r.label, type: r.type, kind: r.kind, date: r.date }));
    expect(legacyShape).toEqual(result.rows.map((r) => ({ label: r.label, type: r.type, kind: r.kind, date: r.date })));
  });

  it("runNoticePipeline (raw-string entry) reaches the SAME result as the object path", () => {
    const viaString = runNoticePipeline(JSON.stringify(recording.answer), allowed, pastedText, 2026, null);
    expect(viaString.rows).toEqual(result.rows);
    expect(viaString.vacancy).toEqual(result.vacancy);
    expect(viaString.importantLinks).toEqual(result.importantLinks);
    expect(viaString.notes).toEqual(result.notes);
  });
});
