/**
 * excelBulkOps.roundtrip.test.ts — export → file → guarded import, per pillar
 * (owner batch 6, Phase X2).
 *
 * The claim being tested is the one that matters when a library is replaced: the same sheet the
 * CMS writes is the same sheet the CMS can read back, field for field, for every pillar it offers
 * — and the import template's headers are a subset of the export's, so a file a staff member
 * downloads, fills in and re-uploads keeps its columns.
 *
 * XLSX.writeFile is not called anywhere here: buildExportWorkbook / buildTemplateWorkbook return
 * the workbook as a value precisely so this can be tested without a browser download.
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildExportWorkbook, buildTemplateWorkbook, type ExportRow,
} from "./excelBulkOps";
import { readSpreadsheetUpload } from "./spreadsheetUpload";

/** Every pillar the CMS offers bulk operations for, with its sheet label. */
const PILLARS: { pillar: string; label: string }[] = [
  { pillar: "entrance-exam", label: "Entrance Exams" },
  { pillar: "sarkari-naukri", label: "Govt Exams" },
  { pillar: "board-university", label: "Board & University" },
];

function rowFor(pillar: string, i: number): ExportRow {
  return {
    name: `${pillar} Test Exam ${i} 2026`,
    shortName: `TE${i}`,
    slug: `${pillar}-test-exam-${i}`,
    pillar,
    region: i % 2 === 0 ? "all-india" : "maharashtra",
    category: i % 2 === 0 ? "Engineering" : "Banking",
    conductingBody: i % 2 === 0 ? "NTA" : "IBPS",
    officialWebsite: "https://example.gov.in",
    status: "upcoming",
    editionYear: 2026,
    editionLabel: "2026",
    session: "main",
    vacancy: 1000 + i,
    notificationDate: "2026-01-15",
    registrationOpens: "2026-02-01",
    registrationCloses: "2026-03-15",
    examDate: "2026-06-15",
    admitCardRelease: "2026-06-01",
    answerKeyRelease: "",
    resultDeclaration: "",
    isFeatured: i === 0,
    isPublished: true,
    seoTitle: `${pillar} Exam ${i} 2026 - Dates & Apply`,
    seoDescription: "Short description with a comma, and a quote \"here\".",
    tags: "a, b, c",
  };
}

/** Turn a workbook into the File the picker would have produced. */
async function fileFrom(wb: XLSX.WorkBook, sheetName: string, fileName: string): Promise<File> {
  const bytes = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
  return new File([bytes], fileName);
}

/**
 * Cell round-trips are not byte-identical by design: an empty cell comes back as "" and a null
 * number comes back as "" too. This is the normalisation the test compares against, so the
 * assertion is about the VALUES, not about JavaScript's three ways of saying "nothing".
 */
const norm = (v: unknown): string | number | boolean => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
};

describe("export → import round trip, per pillar", () => {
  for (const { pillar, label } of PILLARS) {
    it(`${pillar}: every field of an exported row survives the file and comes back through the gate`, async () => {
      const rows = [rowFor(pillar, 1), rowFor(pillar, 2), rowFor(pillar, 3)];
      const wb = buildExportWorkbook(rows, label);
      const file = await fileFrom(wb, label, `${pillar}-exams-export.xlsx`);

      const parsed = await readSpreadsheetUpload(file);
      expect(parsed.kind).toBe("xlsx");
      expect(parsed.sheetName).toBe(label);
      expect(parsed.rows).toHaveLength(rows.length);

      for (let i = 0; i < rows.length; i++) {
        const back = parsed.rows[i] as Record<string, unknown>;
        for (const key of Object.keys(rows[i]) as (keyof ExportRow)[]) {
          expect(
            norm(back[key]),
            `${pillar} row ${i} field "${key}"`,
          ).toBe(norm(rows[i][key]));
        }
      }
    });

    it(`${pillar}: the sheet carries one column per ExportRow field, in the export's order`, async () => {
      const wb = buildExportWorkbook([rowFor(pillar, 1)], label);
      const ws = wb.Sheets[wb.SheetNames[0]]!;
      // header:1 returns rows-as-arrays, so the generic is unknown[] here, not an object map
      const headers = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] as string[];
      expect(headers).toEqual(Object.keys(rowFor(pillar, 1)));
      expect(ws["!cols"]).toHaveLength(headers.length);   // widths must not drift from the columns
    });
  }
});

describe("the import template and the export agree", () => {
  it("the template round-trips through the same gate", async () => {
    const wb = buildTemplateWorkbook();
    const file = await fileFrom(wb, "Template", "entrance-exam-import-template.xlsx");
    const parsed = await readSpreadsheetUpload(file);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      name: "Example Exam Name 2026",
      region: "all-india",
      conductingBody: "Example Board",
      status: "upcoming",
      notificationDate: "2026-01-15",
    });
  });

  it("every template column exists in the export, so a filled template re-imports cleanly", async () => {
    const templateWs = buildTemplateWorkbook().Sheets["Template"]!;
    const templateHeaders = new Set(
      Object.keys(XLSX.utils.sheet_to_json<Record<string, unknown>>(templateWs)[0]),
    );
    const exportHeaders = new Set(Object.keys(rowFor("entrance-exam", 1)));
    const onlyInTemplate = [...templateHeaders].filter((h) => !exportHeaders.has(h));
    expect(onlyInTemplate, "template columns the export does not write").toEqual([]);
  });

  it("the template's example year is this year, so it never teaches a stale edition", async () => {
    const ws = buildTemplateWorkbook().Sheets["Template"]!;
    const row = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)[0];
    expect(Number(row.editionYear)).toBe(new Date().getFullYear());
  });
});

describe("the vendored library is the one the code got", () => {
  it("reports the SheetJS version committed under vendor/", () => {
    expect(XLSX.version).toBe("0.20.3");
  });
});
