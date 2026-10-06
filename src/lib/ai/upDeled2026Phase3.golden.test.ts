/**
 * S2.7 golden test — the UP D.El.Ed 2026 Phase-3 notice.
 *
 * FIXTURES (src/lib/ai/__fixtures__/up-deled-2026-phase3/):
 *   pasted.txt            — the owner's structured extraction of the notice.
 *                           ⚠ THE OWNER'S ATTACHMENT DID NOT REACH THIS SESSION:
 *                           the file is RECONSTRUCTED from the documented facts
 *                           (design doc §15 + the acceptance table) and keeps
 *                           BOTH required test cases — the utm_source tracking
 *                           URL and the "समस्त आवंटित अभ्यर्थी" mistranscription.
 *                           Replace with the verbatim paste when supplied; the
 *                           recorded answer quotes these lines, so quotes move
 *                           with it.
 *   model.responses.json  — the RECORDED raw model output for that text
 *                           (invented types, a distribution-list stray, utm
 *                           URL — realistic, not a copy of expected.json);
 *   expected.json         — the owner's acceptance table.
 *
 * DETERMINISTIC CI PATH: runNoticePipeline() — OUR post-processing (option
 * validation, kind/type mapping, date/time parsing, URL hygiene,
 * distribution-list rejection, eligibility source-quote check) must turn the
 * recorded raw answer into expected.json. No network.
 *
 * LIVE PATH (opt-in): LIVE=1 calls the deployed ai-fill NOTICE_EXTRACT_V1
 * template and records the answer beside the fixtures as
 * model.responses.live.json for report comparison. Runs ONLY after the owner
 * approves the Edge Function deploy (S2.3) — skipped otherwise.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runNoticePipeline } from "./noticePipeline";
import type { AllowedOptions } from "./extractionContract";

const FIX = (name: string) =>
  resolve(__dirname, `./__fixtures__/up-deled-2026-phase3/${name}`);

const pastedText = readFileSync(FIX("pasted.txt"), "utf8");
const recording = JSON.parse(readFileSync(FIX("model.responses.json"), "utf8")) as { raw: string };
const expected = JSON.parse(readFileSync(FIX("expected.json"), "utf8"));

/** The allowed options a call would read at run time (mirrors the live lists —
 *  teaching-and-education exists, up exists, entrance choices exist). */
const allowed: AllowedOptions = {
  categories: [
    { slug: "teaching-and-education", name: "Teaching and Education" },
    { slug: "engineering", name: "Engineering" },
    { slug: "management", name: "Management" },
  ],
  regions: [
    { slug: "up", label: "Uttar Pradesh" },
    { slug: "all-india", label: "All India" },
  ],
  entityTypes: ["exam", "university-admission"],
  selectionModels: ["written-exam", "merit-based", "interview-based", "internal-admission"],
};

const result = runNoticePipeline(recording.raw, allowed, pastedText, 2026);

describe("golden: UP D.El.Ed 2026 Phase-3 — fields (S2.7)", () => {
  it("name carries D.El.Ed and NOT Entrance", () => {
    const name = result.fields.name.value;
    expect(name).toBe(expected.name.value);
    expect(name).toContain("D.El.Ed");
    expect(name).not.toContain(expected.name.mustNotContain);
    expect(result.fields.name.sourceQuote).toBe(expected.name.sourceQuote);
  });

  it("category teaching-and-education and selection model merit-based (chosen WITH a reason)", () => {
    expect(result.fields.categorySlug.value).toBe(expected.categorySlug.value);
    expect(result.fields.categorySlug.flagged).toBe(false);
    expect(result.fields.selectionModel.value).toBe(expected.selectionModel.value);
    expect(result.fields.selectionModel.reason).toBe(expected.selectionModel.reason);
    expect(result.fields.entityType.value).toBe(expected.entityType.value);
    expect(result.fields.region.value).toBe(expected.region.value);
  });

  it("URL hygiene: the tracking URL loses utm_source but keeps the host", () => {
    const url = result.fields.officialWebsite.value;
    expect(url).toContain(expected.officialWebsite.host);
    expect(url).not.toMatch(/utm_|fbclid|gclid|chatgpt/i);
  });

  it("eligibility says NOT YET ALLOTTED and its quote is flagged as the mistranscription", () => {
    const el = result.fields.eligibility;
    expect(el.value).toBe(expected.eligibility.value);
    expect(el.value).toMatch(/not yet allotted/i);
    expect(el.sourceQuote).toBe(expected.eligibility.sourceQuote); // the "आवंटित" line is SHOWN
    expect(el.sourceQuote).toContain("समस्त आवंटित अभ्यर्थी");
    expect(el.flagged).toBe(true);
    expect(el.flagReason).toMatch(new RegExp(expected.eligibility.flagPattern));
  });

  it("the ₹5,000 fee is flagged 'counselling fee — no field yet', never written to application_fee", () => {
    const fee = result.fields.fee;
    expect(fee.value).toBe(expected.fee.value);
    expect(fee.flagReason).toBe(expected.fee.flag);
  });

  it("warnings / contacts / notice reference survive with quotes", () => {
    expect(result.fields.warnings.value).toBe(expected.warnings.value);
    expect(result.fields.contacts.value).toBe(expected.contacts.value);
    expect(result.fields.noticeReference.value).toBe(expected.noticeReference.value);
  });
});

describe("golden: date rows — kinds, windows, IST times (S2.7)", () => {
  it("produces EXACTLY the four Phase-3 rows expected.json defines", () => {
    expect(result.rows).toEqual(expected.dates);
  });

  it("the invented model types were OVERRIDDEN by the kind→type table", () => {
    for (const t of expected.typeInventedOverrides) {
      const hit = result.warnings.find((w) => w.includes(t.labelContains) && w.includes(t.from) && w.includes(`"${t.to}"`));
      expect(hit, `warning missing for ${t.labelContains}: ${result.warnings.join(" | ")}`).toBeTruthy();
    }
  });

  it("nothing says 'Registration Opens 5 Oct' — the window is choice_filling", () => {
    const cf = result.rows.find((r) => r.date === "2026-10-05");
    expect(cf?.kind).toBe("choice_filling");
    expect(cf?.type).toBe("counselling"); // VIEW vocabulary — drives counselling, not app-open
    expect(result.rows.some((r) => r.kind === "registration_start" && r.date === "2026-10-05")).toBe(false);
  });
});

describe("golden: provenance rows and rejections (S2.7)", () => {
  it("the counselling notice 07.08.2026 is a DOCUMENT REFERENCE, not a Notification row", () => {
    expect(result.references).toEqual(expected.references);
    expect(result.rows.some((r) => r.kind === "notification")).toBe(false);
    expect(result.rows.some((r) => r.date === "2026-08-07")).toBe(false);
  });

  it("the page-2 distribution stray is REJECTED, with the reason recorded", () => {
    expect(result.rows.some((r) => r.label === "DM Seat Matrix Meeting")).toBe(false);
    const rej = result.rejected.find((r) => r.label === "DM Seat Matrix Meeting");
    expect(rej).toBeTruthy();
    expect(rej!.reason).toMatch(new RegExp(expected.rejected[0].reasonPattern));
  });

  it("no distribution-list content leaked into ANY output field, row or reference", () => {
    const output = JSON.stringify({ fields: result.fields, rows: result.rows, references: result.references });
    for (const forbidden of expected.forbiddenAnywhere) {
      expect(output, `forbidden string "${forbidden}" found in pipeline output`).not.toContain(forbidden);
    }
  });
});

describe.skipIf(process.env.LIVE !== "1")("golden: live model run (LIVE=1, after S2.3 deploy approval)", () => {
  it("calls the deployed NOTICE_EXTRACT_V1 and records the answer beside the fixtures", async () => {
    const { generateStructured } = await import("./aiFillClient");
    const ext = await generateStructured("NOTICE_EXTRACT_V1", pastedText, {
      pillar: "entrance-exam",
      consumer: "golden-live",
    });
    const liveRaw = JSON.stringify({ fields: ext.content.fields, dates: ext.content.dates, references: ext.content.references ?? [] });
    // Second recording — kept for the report's live-vs-expected comparison.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(FIX("model.responses.live.json"), liveRaw + "\n");
    // The same post-processing must satisfy the same acceptance table.
    const live = runNoticePipeline(liveRaw, allowed, pastedText, 2026);
    expect(live.rows.map((r) => [r.kind, r.date, r.end_date ?? null])).toEqual(
      expected.dates.map((r: { kind: string; date: string; end_date?: string }) => [r.kind, r.date, r.end_date ?? null]),
    );
    expect(live.fields.categorySlug.value).toBe(expected.categorySlug.value);
  }, 60_000);
});
