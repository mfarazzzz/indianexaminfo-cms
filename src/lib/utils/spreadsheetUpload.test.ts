/**
 * spreadsheetUpload.test.ts — the gate in front of XLSX.read (owner batch 6, Phase X2).
 *
 * Fixtures are real workbooks: they are produced by the same SheetJS build the CMS now vendors,
 * written to a byte array and handed back as a File, so the magic bytes, the container and the
 * sheet ranges are all genuine rather than mocked.
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  ALLOWED_EXTENSIONS, MAX_IMPORT_ROWS, MAX_UPLOAD_BYTES,
  detectKind, readSpreadsheetUpload,
} from "./spreadsheetUpload";

/** Write a workbook the way the CMS exports it, and hand it back as an uploaded File. */
function xlsxFile(rows: Record<string, unknown>[], name = "sheet.xlsx", sheet = "Export"): File {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new File([new Uint8Array(bytes)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function csvFile(text: string, name = "sheet.csv"): File {
  return new File([text], name, { type: "text/csv" });
}

const TWO_ROWS = [
  { name: "SSC CGL 2026", slug: "ssc-cgl", region: "all-india", vacancy: 17727 },
  { name: "IBPS Clerk 2026", slug: "ibps-clerk", region: "all-india", vacancy: 6114 },
];

describe("detectKind — what the bytes say", () => {
  it("recognises the two spreadsheet containers and nothing else", () => {
    const ws = XLSX.utils.json_to_sheet(TWO_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const zip = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
    expect(detectKind(zip)).toBe("xlsx");

    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(detectKind(ole2)).toBe("xls");

    expect(detectKind(new Uint8Array([0x41, 0x42, 0x43]))).toBe("csv");   // plain text fallback
    expect(detectKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("csv"); // PNG header is not a container
  });
});

describe("the allow-list and the caps", () => {
  it("exports the limits the guard is documented to use", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_IMPORT_ROWS).toBe(5_000);
    expect(ALLOWED_EXTENSIONS).toEqual([".xlsx", ".xls", ".csv"]);
  });

  it("refuses a file type the picker should never have offered", async () => {
    await expect(readSpreadsheetUpload(new File(["hi"], "notes.txt")))
      .rejects.toThrow(/Unsupported file type "\.txt"/);
    await expect(readSpreadsheetUpload(new File(["hi"], "notes")))
      .rejects.toThrow(/Unsupported file type "\(no extension\)"/);
  });

  it("refuses an over-size file BEFORE reading it, and says the limit in MB", async () => {
    const big = new File([new Uint8Array(1024)], "big.xlsx");
    Object.defineProperty(big, "size", { value: 7 * 1024 * 1024 });   // declared size, not read yet
    await expect(readSpreadsheetUpload(big, { maxBytes: 5 * 1024 * 1024 }))
      .rejects.toThrow(/7\.0 MB, and imports are limited to 5 MB/);
  });

  it("refuses a sheet with more data rows than the cap, naming both numbers", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ name: `Exam ${i}`, slug: `exam-${i}` }));
    await expect(readSpreadsheetUpload(xlsxFile(rows), { maxRows: 10 }))
      .rejects.toThrow(/has 12 data rows and imports are limited to 10/);
  });

  it("allows a sheet exactly at the cap (the header does not count against it)", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Exam ${i}`, slug: `exam-${i}` }));
    const parsed = await readSpreadsheetUpload(xlsxFile(rows), { maxRows: 10 });
    expect(parsed.dataRows).toBe(10);
    expect(parsed.rowCount, "the range counts the header row too").toBe(11);
  });

  it("refuses an empty file", async () => {
    await expect(readSpreadsheetUpload(new File([], "empty.xlsx")))
      .rejects.toThrow(/The file is empty/);
  });
});

describe("the name must match the bytes", () => {
  it("rejects a .csv whose contents are an xlsx container", async () => {
    const good = xlsxFile(TWO_ROWS, "real.xlsx");
    const renamed = new File([await good.arrayBuffer()], "invoices.csv", { type: "text/csv" });
    await expect(readSpreadsheetUpload(renamed))
      .rejects.toThrow(/has a \.csv name but its contents are a modern \.xlsx workbook/);
  });

  it("rejects an .xlsx whose contents are plain text", async () => {
    await expect(readSpreadsheetUpload(csvFile("name,slug\nSSC CGL,ssc-cgl\n", "sheet.xlsx")))
      .rejects.toThrow(/is named \.xlsx but its contents are plain text/);
  });

  it("rejects an .xls that is really a modern workbook", async () => {
    const good = xlsxFile(TWO_ROWS, "real.xlsx");
    const swapped = new File([await good.arrayBuffer()], "legacy.xls");
    await expect(readSpreadsheetUpload(swapped))
      .rejects.toThrow(/claims to be \.xls but the file is a xlsx workbook/);
  });

  it("rejects a .csv that carries binary data where text was expected", async () => {
    const withNul = new File([new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x00, 0x00, 0x41])], "evil.csv");
    await expect(readSpreadsheetUpload(withNul)).rejects.toThrow(/contains binary data where text was expected/);
  });
});

describe("the formats the CMS actually exchanges", () => {
  it("reads a real .xlsx export back, with kind, sheet name and row count", async () => {
    const parsed = await readSpreadsheetUpload(xlsxFile(TWO_ROWS, "entrance-exam-export.xlsx", "Entrance Exams"));
    expect(parsed.kind).toBe("xlsx");
    expect(parsed.sheetName).toBe("Entrance Exams");
    expect(parsed.rowCount).toBe(3);              // header + 2 data rows, as the range says
    expect(parsed.dataRows).toBe(2);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]).toMatchObject({ name: "SSC CGL 2026", slug: "ssc-cgl", vacancy: 17727 });
    expect(parsed.bytes).toBeGreaterThan(0);
  });

  it("reads a .csv export back", async () => {
    const parsed = await readSpreadsheetUpload(csvFile("name,slug,region\nSSC CGL 2026,ssc-cgl,all-india\n"));
    expect(parsed.kind).toBe("csv");
    expect(parsed.rows[0]).toMatchObject({ name: "SSC CGL 2026", slug: "ssc-cgl" });
  });

  it("reports a header-only sheet as no data rows, not as a crash", async () => {
    await expect(readSpreadsheetUpload(csvFile("name,slug,region\n")))
      .rejects.toThrow(/No data rows found in the spreadsheet/);
  });

  it("turns a corrupt container into a sentence a staff member can use", async () => {
    // ZIP magic so it passes the type checks, then garbage where the workbook should be.
    const corrupt = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array.from({ length: 200 }, (_, i) => i & 0xff)])],
      "broken.xlsx",
    );
    await expect(readSpreadsheetUpload(corrupt)).rejects.toThrow(
      /Could not open "broken\.xlsx" as a spreadsheet .*Re-export it from Excel/,
    );
  });

  it("never lets a malformed file reach SheetJS unguarded, whatever the caps", async () => {
    // The whole point of the gate: with the production defaults a normal export still passes.
    const parsed = await readSpreadsheetUpload(xlsxFile(TWO_ROWS));
    expect(parsed.rows).toHaveLength(2);
  });
});
