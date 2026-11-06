/**
 * vacancyBulkOps.test.ts — owner batch 7, Phase C2b. The rules that protect 361 live rows.
 *
 * The import path is the first place this CMS can rewrite hundreds of published records at
 * once, so every guard in the brief is pinned here: match by id, NEVER create, never clear,
 * never overwrite a non-empty value unless `overwrite` is ticked, ISO dates only (repairs are
 * reported, nonsense is refused), application_end >= application_start, https on an official
 * host or flagged, the verification consequence said out loud, and a malformed file rejected
 * by the SAME gate the exam importer uses — not by a rule invented here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("@/lib/supabase/client", () => ({ db: { from: vi.fn() } }));
import { db } from "@/lib/supabase/client";

import {
  VACANCY_IMPORT_COLUMNS, TOP_VACANCY_SLUGS, JOBPOSTING_GATES,
  normaliseDateCell, classifyUrlCell, planVacancyRows, applyVacancyPlans,
  sortTopFirst, buildVacancyExportWorkbook, readVacancySheet,
  type VacancyCurrent, type VacancyRowPlan,
} from "./vacancyBulkOps";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function vacancy(over: Partial<VacancyCurrent> = {}): VacancyCurrent {
  return {
    id: ID, slug: "up-swasthya-vibhag-ambulance-driver-2026",
    title: "UP Swasthya Vibhag Ambulance Driver Bharti 2026",
    organization: "UP Directorate of Health", state: "uttar-pradesh",
    recruitment_type: "direct", workflow_status: "published", verified_at: null,
    notification_date: null, application_start_date: null, application_end_date: null,
    official_notification_url: null, application_url: null, vacancy_count: null, exam_date: null,
    ...over,
  };
}
const byId = (rows: VacancyCurrent[]) => new Map(rows.map((r) => [r.id, r]));

describe("normaliseDateCell", () => {
  it("accepts an ISO date unchanged", () => {
    expect(normaliseDateCell("2026-11-05")).toEqual({ iso: "2026-11-05" });
  });
  it("treats blank as nothing-to-write, not as an error", () => {
    expect(normaliseDateCell("")).toEqual({ iso: null });
    expect(normaliseDateCell("   ")).toEqual({ iso: null });
    expect(normaliseDateCell(null)).toEqual({ iso: null });
  });
  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "1999-04-31"])("refuses the impossible date %s", (v) => {
    const r = normaliseDateCell(v);
    expect(r.iso).toBeNull();
    expect(r.error).toMatch(/not a real calendar date/);
  });
  it("repairs day/month/year and SAYS so", () => {
    const r = normaliseDateCell("5/11/2026");
    expect(r.iso).toBe("2026-11-05");
    expect(r.note).toMatch(/day\/month\/year/);
  });
  it("repairs an Excel date serial and SAYS so", () => {
    const r = normaliseDateCell(46331);          // 2026-11-05 in the 1900 system (serial 1 = 1900-01-01)
    expect(r.iso).toBe("2026-11-05");
    expect(r.note).toMatch(/Excel date serial/);
  });
  it("repairs a Date object coming back from the sheet", () => {
    const r = normaliseDateCell(new Date(Date.UTC(2026, 10, 5)));
    expect(r.iso).toBe("2026-11-05");
    expect(r.note).toMatch(/date cell/);
  });
  it.each(["last date", "2026-11", "0", "-"] as const)("refuses %s as not a date", (v) => {
    const r = normaliseDateCell(v);
    expect(r.iso).toBeNull();
    expect(r.error).toMatch(/is not a date/);
  });
  it("refuses a number that is too small to be a date serial rather than guessing", () => {
    expect(normaliseDateCell(45).error).toMatch(/not a date/);
  });
});

describe("classifyUrlCell", () => {
  it("accepts a gov.in / nic.in https link as-is", () => {
    expect(classifyUrlCell("https://uphealth.up.gov.in/notice/ambulance-driver-2026.pdf")).toEqual({
      url: "https://uphealth.up.gov.in/notice/ambulance-driver-2026.pdf",
    });
    expect(classifyUrlCell("https://ssc.nic.in/").url).toBe("https://ssc.nic.in/");
  });
  it("allows but FLAGS a non-official host (the owner said 'or flagged')", () => {
    const r = classifyUrlCell("https://example.com/notice.pdf");
    expect(r.url).toBe("https://example.com/notice.pdf");
    expect(r.warning).toMatch(/not a gov\.in\/nic\.in-style official host/);
  });
  it("flags plain http", () => {
    expect(classifyUrlCell("http://ssc.nic.in/x.pdf").warning).toMatch(/https/);
  });
  it.each(["not a url", "ssc.nic.in/x.pdf", "ftp://x/y", "javascript:alert(1)"])("refuses %s", (v) => {
    const r = classifyUrlCell(v);
    expect(r.url).toBeNull();
    expect(r.error).toBeTruthy();
  });
});

describe("planVacancyRows — the safety rules", () => {
  it("writes every whitelisted field from a good row and nothing else", () => {
    const { plans, counts } = planVacancyRows([{
      id: ID, slug: vacancy().slug,
      notification_date: "2026-10-01", application_start_date: "2026-10-05",
      application_end_date: "2026-11-30", official_notification_url: "https://uphealth.up.gov.in/n.pdf",
      application_url: "https://uphealth.up.gov.in/apply", vacancy_count: "4,500", exam_date: "2026-12-20",
      some_stray_column: "ignored",
    }], byId([vacancy()]));
    expect(plans[0].valid).toBe(true);
    expect(plans[0].writes).toEqual({
      notification_date: "2026-10-01", application_start_date: "2026-10-05", application_end_date: "2026-11-30",
      official_notification_url: "https://uphealth.up.gov.in/n.pdf", application_url: "https://uphealth.up.gov.in/apply",
      vacancy_count: 4500, exam_date: "2026-12-20",
    });
    expect(Object.keys(plans[0].writes)).not.toContain("some_stray_column");
    expect(Object.keys(plans[0].writes).every((k) => (VACANCY_IMPORT_COLUMNS as readonly string[]).includes(k))).toBe(true);
    expect(counts).toEqual({ rows: 1, writable: 1, blocked: 0, noChange: 0 });
  });

  it("an empty cell never clears a stored value", () => {
    const stored = vacancy({ notification_date: "2026-09-01" });
    const { plans } = planVacancyRows([{ id: ID, notification_date: "" }], byId([stored]));
    expect(plans[0].writes.notification_date).toBeUndefined();
    expect(plans[0].skipped.find((s) => s.column === "notification_date")?.reason).toMatch(/current value stays/);
  });

  it("refuses to overwrite a non-empty value until overwrite is ticked", () => {
    const stored = vacancy({ application_end_date: "2026-11-30" });
    const row = { id: ID, application_end_date: "2027-01-31" };
    const without = planVacancyRows([row], byId([stored]));
    expect(without.plans[0].writes.application_end_date).toBeUndefined();
    expect(without.plans[0].skipped.find((s) => s.reason.includes("overwrite"))).toBeTruthy();

    const withIt = planVacancyRows([row], byId([stored]), { overwrite: true });
    expect(withIt.plans[0].writes.application_end_date).toBe("2027-01-31");
  });

  it("matches by id and NEVER creates a row", () => {
    const { plans, counts } = planVacancyRows([
      { id: OTHER, notification_date: "2026-10-01" },
      { notification_date: "2026-10-01" },
      { id: "  ", notification_date: "2026-10-01" },
    ], byId([vacancy()]));
    expect(plans[0].valid).toBe(false);
    expect(plans[0].errors[0]).toMatch(/is not a vacancy row|nothing is created/);
    expect(plans[1].errors[0]).toMatch(/no id/);
    expect(plans[2].errors[0]).toMatch(/no id/);
    expect(counts.blocked).toBe(3);
    expect(counts.writable).toBe(0);
  });

  it("blocks a reversed application window using the sheet values", () => {
    const { plans } = planVacancyRows([{
      id: ID, application_start_date: "2026-12-05", application_end_date: "2026-11-05",
    }], byId([vacancy()]));
    expect(plans[0].valid).toBe(false);
    expect(plans[0].errors[0]).toMatch(/application_end_date 2026-11-05 is before application_start_date 2026-12-05/);
  });

  it("blocks the reversal even when one bound comes from the stored row", () => {
    const stored = vacancy({ application_start_date: "2026-12-05" });
    const { plans } = planVacancyRows([{ id: ID, application_end_date: "2026-11-05" }], byId([stored]), { overwrite: true });
    expect(plans[0].valid).toBe(false);
  });

  it("warns when the last date is already past (that row still earns no JobPosting)", () => {
    const { plans } = planVacancyRows([{ id: ID, application_end_date: "2026-01-10" }], byId([vacancy()]), { todayISO: "2026-11-06" });
    expect(plans[0].valid).toBe(true);
    expect(plans[0].warnings.join(" ")).toMatch(/already past/);
  });

  it("warns that a verified row loses its verification when a gated field moves", () => {
    const stored = vacancy({ verified_at: "2026-09-15T10:00:00Z" });
    const { plans } = planVacancyRows([{ id: ID, application_end_date: "2026-11-30" }], byId([stored]));
    expect(plans[0].warnings.join(" ")).toMatch(/voids that verification|re-verify/);
  });

  it("says nothing about verification when only a non-gated field moves", () => {
    const stored = vacancy({ verified_at: "2026-09-15T10:00:00Z" });
    const { plans } = planVacancyRows([{ id: ID, application_url: "https://uphealth.up.gov.in/apply" }], byId([stored]));
    expect(plans[0].warnings.join(" ")).not.toMatch(/verification/);
  });

  it("reports the sheet's own slug mismatch instead of trusting it", () => {
    const { plans } = planVacancyRows([{ id: ID, slug: "a-different-slug", exam_date: "2026-12-01" }], byId([vacancy()]));
    expect(plans[0].warnings.join(" ")).toMatch(/the id wins/);
    expect(plans[0].valid).toBe(true);
  });

  it("per-row errors do not stop the other rows", () => {
    const { counts, plans } = planVacancyRows([
      { id: ID, notification_date: "nonsense" },
      { id: ID, notification_date: "2026-10-01" },
    ], byId([vacancy()]));
    expect(plans[0].valid).toBe(false);
    expect(plans[1].valid).toBe(true);
    expect(counts).toEqual({ rows: 2, writable: 1, blocked: 1, noChange: 0 });
  });

  it("counts a valid row with nothing to write separately from a blocked one", () => {
    const { counts } = planVacancyRows([{ id: ID }], byId([vacancy()]));
    expect(counts).toEqual({ rows: 1, writable: 0, blocked: 0, noChange: 1 });
  });
});

describe("applyVacancyPlans", () => {
  const update = vi.fn();
  const eq = vi.fn(async () => ({ error: null }));
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockReturnValue({ eq });
    vi.mocked(db.from).mockReturnValue({ update } as never);
  });

  it("updates by id on sarkari_naukri, writes only whitelisted columns, and refuses bad rows", async () => {
    const plans = [
      { rowNumber: 2, id: ID, slug: null, writes: { notification_date: "2026-10-01" }, skipped: [], errors: [], warnings: [], valid: true },
      { rowNumber: 3, id: OTHER, slug: null, writes: {}, skipped: [], errors: ["unknown id"], warnings: [], valid: false },
      { rowNumber: 4, id: ID, slug: null, writes: {}, skipped: [{ column: "application_url", reason: "empty" }], errors: [], warnings: [], valid: true },
    ] as VacancyRowPlan[];
    const res = await applyVacancyPlans(plans);
    expect(res).toEqual({ updated: 1, refused: 1, untouched: 1, failures: [] });
    expect(db.from).toHaveBeenCalledWith("sarkari_naukri");
    expect(update).toHaveBeenCalledWith({ notification_date: "2026-10-01" });
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it("surfaces a per-row database failure instead of aborting the batch", async () => {
    update.mockReturnValue({ eq: vi.fn(async () => ({ error: { message: "row is locked" } })) });
    const res = await applyVacancyPlans([
      { rowNumber: 2, id: ID, slug: null, writes: { exam_date: "2026-12-01" }, skipped: [], errors: [], warnings: [], valid: true },
      { rowNumber: 3, id: OTHER, slug: null, writes: { exam_date: "2026-12-02" }, skipped: [], errors: [], warnings: [], valid: true },
    ] as VacancyRowPlan[]);
    expect(res.updated).toBe(0);
    expect(res.failures).toHaveLength(2);
    expect(res.failures[0].message).toBe("row is locked");
  });
});

describe("export shape — the sheet the owner fills in", () => {
  function rows(): VacancyCurrent[] {
    const rest = ["zzz-last-2026", "aaa-first-2026"].map((slug, i) => vacancy({ id: `r${i}`, slug }));
    const top = TOP_VACANCY_SLUGS.slice(0, 3).map((slug, i) => vacancy({ id: `t${i}`, slug }));
    return [...rest, ...top];
  }

  it("puts the twenty high-traffic slugs first, in the owner's order, then the rest A-Z", () => {
    const sorted = sortTopFirst(rows());
    expect(sorted.slice(0, 3).map((r) => r.slug)).toEqual(TOP_VACANCY_SLUGS.slice(0, 3));
    expect(sorted.slice(3).map((r) => r.slug)).toEqual(["aaa-first-2026", "zzz-last-2026"]);
  });

  it("carries id, the reader-facing context and the current values of every writable column", () => {
    const ws = buildVacancyExportWorkbook([vacancy({ notification_date: "2026-09-01" })]).Sheets["vacancies"]!;
    const recs = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    expect(Object.keys(recs[0]).sort()).toEqual(
      ["id", "slug", "title", "organization", "state", "recruitment_type", "workflow_status", "verified_at", ...VACANCY_IMPORT_COLUMNS].sort(),
    );
    expect(recs[0].notification_date).toBe("2026-09-01");
    expect(recs[0].id).toBe(ID);
  });

  it("round-trips: the exported sheet is readable by the same gate the import uses", async () => {
    const wb = buildVacancyExportWorkbook(rows());
    const bytes = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
    const file = new File([bytes], "fill.xlsx");
    const { records } = await readVacancySheet(file);
    expect(records).toHaveLength(5);
    expect(records[0].slug).toBe(TOP_VACANCY_SLUGS[0]);
    const { plans } = planVacancyRows(records, byId(rows()));
    // an untouched export contains no empty cells that could clear anything: every row is
    // "nothing to write", because every value came from the row itself.
    expect(plans.every((p) => Object.keys(p.writes).length === 0)).toBe(true);
  });

  it("rejects a malformed file with the shared gate's words, not its own", async () => {
    const bogus = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8])], "fill.csv");
    await expect(readVacancySheet(bogus)).rejects.toThrow(/\.csv name but its contents/);
    await expect(readVacancySheet(new File([new Uint8Array([1, 2, 3])], "fill.txt"))).rejects.toThrow(/Unsupported file type/);
  });
});

describe("the gate list the owner is working against", () => {
  it("names exactly the five conditions JobPosting needs, in fill order", () => {
    expect(JOBPOSTING_GATES.map((g) => g.column)).toEqual([
      "notification_date", "application_start_date", "application_end_date",
      "official_notification_url", "__verified__",
    ]);
    expect(TOP_VACANCY_SLUGS).toHaveLength(20);
  });
});
