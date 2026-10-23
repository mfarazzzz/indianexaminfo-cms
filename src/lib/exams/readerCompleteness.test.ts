/**
 * readerCompleteness.test.ts — pins the "What readers will see" rules (item 2).
 * The section rows must agree with the mirrored hasData; the update rows must
 * agree with the reader filters (published / not withdrawn / not expired) and
 * the attested-URL rule (a link only counts when a live update CARRIES a url).
 */
import { describe, it, expect } from "vitest";
import {
  computeReaderCompleteness,
  isLiveUpdateView,
  readerVisibleUpdates,
  supersededUpdateIds,
  orderRowsForFixFirst,
  summarizeReaderCompleteness,
  type ReaderFormView,
  type ReaderUpdateView,
} from "./readerCompleteness";

const NOW = "2026-10-22T12:00:00.000Z";

function form(over: Partial<ReaderFormView> = {}): ReaderFormView {
  return {
    pillar: "government-exam",
    conductingBody: "UPSSSC",
    officialWebsite: "https://upsssc.gov.in",
    cycleFrequency: "annual",
    dates: [{ label: "Admit card", date: "2026-10-17" }],
    eligibility: { age: "18-40", qualification: "12th", nationality: "Indian" },
    vacancy: 1000,
    applicationFee: { general: 25 },
    selectionProcess: ["PET", "Main"],
    faqs: [{ question: "Q?", answer: "A full sentence." }],
    contentModules: { "application-process": { steps: [{ title: "s1" }] } },
    isVerified: false,
    verifiedAt: null,
    ...over,
  };
}

const row = (rows: ReturnType<typeof computeReaderCompleteness>, key: string) => {
  const r = rows.find((x) => x.key === key);
  if (!r) throw new Error(`row ${key} missing`);
  return r;
};

describe("isLiveUpdateView (mirrors the frontend reader filter)", () => {
  it("published, not withdrawn, not expired", () => {
    expect(isLiveUpdateView({ status: "published" }, NOW)).toBe(true);
    expect(isLiveUpdateView({ status: "draft" }, NOW)).toBe(false);
    expect(isLiveUpdateView({ status: "published", kind: "withdrawn" }, NOW)).toBe(false);
    expect(isLiveUpdateView({ status: "published", expiresAt: "2026-10-21T00:00:00Z" }, NOW)).toBe(false);
    expect(isLiveUpdateView({ status: "published", expiresAt: null }, NOW)).toBe(true);
  });
});

describe("computeReaderCompleteness", () => {
  it("a complete record reports filled across the section rows", () => {
    const rows = computeReaderCompleteness(form(), [], { nowISO: NOW, quickInfoCardEnabled: true });
    for (const k of ["important-dates", "eligibility", "fee", "vacancy", "selection-process", "how-to-steps", "faq", "quick-info-card", "official-website"]) {
      expect(row(rows, k).status, k).toBe("filled");
    }
  });

  it("empty structured fields report empty, never filled (hasData is the ONE gate)", () => {
    const rows = computeReaderCompleteness(
      form({ dates: [], eligibility: null, vacancy: 0, applicationFee: { general: 0 }, selectionProcess: [], faqs: [{ question: "Q", answer: "N/A" }], contentModules: {} }),
      [],
      { nowISO: NOW },
    );
    expect(row(rows, "important-dates").status).toBe("empty");
    expect(row(rows, "eligibility").status).toBe("empty");
    expect(row(rows, "fee").status).toBe("empty");
    expect(row(rows, "vacancy").status).toBe("empty");
    expect(row(rows, "selection-process").status).toBe("empty");
    // "N/A" is the pinned FAQ placeholder token — a lone placeholder is NO data.
    expect(row(rows, "faq").status).toBe("empty");
    expect(row(rows, "how-to-steps").status).toBe("empty");
  });

  it("an editor-disabled module is BLOCKED, not silently empty", () => {
    const rows = computeReaderCompleteness(
      form({ contentModules: { _config: { enabledModules: ["overview"] }, "application-process": { steps: [{ title: "s1" }] } } }),
      [],
      { nowISO: NOW },
    );
    expect(row(rows, "how-to-steps").status).toBe("blocked");
  });

  it("updates + attested action follow the live filters", () => {
    const live: ReaderUpdateView[] = [{ status: "published", quickLinks: [{ label: "Download Admit Card", url: "https://x/admit" }] }];
    const rows = computeReaderCompleteness(form(), live, { nowISO: NOW });
    expect(row(rows, "updates-timeline").status).toBe("filled");
    expect(row(rows, "action-button").status).toBe("filled");

    // expired update → no timeline, and its link is NOT attested for the reader
    const expired: ReaderUpdateView[] = [{ status: "published", expiresAt: "2026-10-01T00:00:00Z", quickLinks: [{ label: "Apply", url: "https://x" }] }];
    const rows2 = computeReaderCompleteness(form(), expired, { nowISO: NOW });
    expect(row(rows2, "updates-timeline").status).toBe("empty");
    expect(row(rows2, "action-button").status).toBe("empty");

    // a label with NO url never lights the button (attested-URL rule)
    const noUrl: ReaderUpdateView[] = [{ status: "published", quickLinks: [{ label: "Apply Online" }] }];
    expect(row(computeReaderCompleteness(form(), noUrl, { nowISO: NOW }), "action-button").status).toBe("empty");
  });

  it("verified line needs flag AND date; quick-info card is blocked until the FE card ships", () => {
    const rows = computeReaderCompleteness(form({ isVerified: true, verifiedAt: null }), [], { nowISO: NOW });
    expect(row(rows, "verified-line").status).toBe("empty");
    const rowsV = computeReaderCompleteness(form({ isVerified: true, verifiedAt: "2026-10-18" }), [], { nowISO: NOW });
    expect(row(rowsV, "verified-line").status).toBe("filled");
    // default (no opt-in) = blocked, because the reader card does not exist yet
    expect(row(rowsV, "quick-info-card").status).toBe("blocked");
  });

  it("every row carries a fix hint and a rail target (the panel jump target)", () => {
    const rows = computeReaderCompleteness(form(), [], { nowISO: NOW });
    expect(rows.length).toBe(13);
    for (const r of rows) {
      expect(r.fixHint.length, r.key).toBeGreaterThan(10);
      expect(["identity", "edition", "modules", "seo", "resources", "syllabus", "news", "editions"]).toContain(r.targetTab);
    }
    expect(summarizeReaderCompleteness(rows)).toMatch(/filled/);
  });

  it("marks pillar-inapplicable sections n/a, not empty/blocked", () => {
    // university-exam has no vacancy / application-fee / selection-process reader section.
    const rows = computeReaderCompleteness(form({ pillar: "university-exam" }), [], { nowISO: NOW, quickInfoCardEnabled: true });
    for (const k of ["vacancy", "fee", "selection-process"]) {
      expect(row(rows, k).status, k).toBe("n/a");
    }
    // and a section that DOES apply to university (faq, important-dates) is not n/a.
    expect(row(rows, "faq").status).not.toBe("n/a");
    expect(summarizeReaderCompleteness(rows)).toMatch(/n\/a/);
  });

  it("a SUPERSEDED update no longer counts as reader-visible (matches partitionUpdates)", () => {
    const set: ReaderUpdateView[] = [
      { id: "old", status: "published", kind: "provisional", quickLinks: [{ label: "Download Admit Card", url: "https://x/old" }] },
      { id: "new", status: "published", kind: "final", supersedesId: "old", quickLinks: [{ label: "Download Admit Card", url: "https://x/new" }] },
    ];
    expect([...supersededUpdateIds(set)]).toEqual(["old"]);
    expect(readerVisibleUpdates(set, NOW).map((u) => u.id)).toEqual(["new"]);
    const rows = computeReaderCompleteness(form(), set, { nowISO: NOW });
    expect(row(rows, "updates-timeline").fixHint).toContain("1 live update");
    // the whole set superseded away → the panel must not claim a timeline
    const onlyOld: ReaderUpdateView[] = [{ id: "a", status: "published" }, { id: "b", status: "published", supersedesId: "a" }];
    expect(readerVisibleUpdates([onlyOld[0]], NOW)).toHaveLength(1); // no edge inside the set
    expect(row(computeReaderCompleteness(form(), [onlyOld[0], onlyOld[1]], { nowISO: NOW }), "updates-timeline").status).toBe("filled");
  });

  it("the Vacancy row agrees with whether the page renders a Vacancy section", () => {
    // pillar WITH the section: the column drives it
    expect(row(computeReaderCompleteness(form({ vacancy: 500 }), [], { nowISO: NOW }), "vacancy").status).toBe("filled");
    expect(row(computeReaderCompleteness(form({ vacancy: 0 }), [], { nowISO: NOW }), "vacancy").status).toBe("empty");
    // pillar WITHOUT the registry section, but the module carries prose → the block
    // still paints a section, so the row may not say "n/a".
    const uniWithProse = form({
      pillar: "university-exam",
      vacancy: 0,
      contentModules: { "vacancy-details": { body: "<p>Seat matrix detail.</p>" }, _config: { enabledModules: ["vacancy-details"] } },
    });
    expect(row(computeReaderCompleteness(uniWithProse, [], { nowISO: NOW }), "vacancy").status).toBe("filled");
    // same, module disabled by the editor → blocked, with the reason in the hint
    const uniOff = form({
      pillar: "university-exam",
      vacancy: 0,
      contentModules: { "vacancy-details": { body: "<p>Seat matrix detail.</p>" }, _config: { enabledModules: ["overview"] } },
    });
    const r = row(computeReaderCompleteness(uniOff, [], { nowISO: NOW }), "vacancy");
    expect(r.status).toBe("blocked");
    expect(r.fixHint).toContain("switched OFF");
  });
});

describe("orderRowsForFixFirst (P2 item 15 panel order)", () => {
  it("blocked, then empty, then n/a, then filled — original order kept inside a group", () => {
    const rows = computeReaderCompleteness(form(), [], { nowISO: NOW, quickInfoCardEnabled: true });
    const ordered = orderRowsForFixFirst(rows);
    expect(ordered).toHaveLength(rows.length);
    const rank = (s: string) => ({ blocked: 0, empty: 1, "n/a": 2, filled: 3 } as Record<string, number>)[s];
    for (let i = 1; i < ordered.length; i++) expect(rank(ordered[i].status)).toBeGreaterThanOrEqual(rank(ordered[i - 1].status));
    // stability inside a group is the panel's own row order, not an alphabetical sort
    const firstEmpty = rows.filter((r) => r.status === "empty").map((r) => r.key);
    expect(ordered.filter((r) => r.status === "empty").map((r) => r.key)).toEqual(firstEmpty);
  });

  it("every row names a real fix surface: a tab, and a focus target where one exists", () => {
    const rows = computeReaderCompleteness(form(), [], { nowISO: NOW, quickInfoCardEnabled: true });
    for (const r of rows) {
      expect(r.targetTab).toBeTruthy();
      if (r.focusKey) expect(r.focusKey).toMatch(/^[a-z][a-z0-9-]*$/i);
    }
  });
});
