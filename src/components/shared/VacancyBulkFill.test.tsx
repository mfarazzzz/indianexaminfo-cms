/**
 * VacancyBulkFill.test.tsx — owner batch 7, C2b. The UI contract of the vacancy importer.
 *
 * The rules themselves live in vacancyBulkOps.ts and are pinned there; what this file
 * proves is that the screen cannot get out of the owner's way or lie about what will
 * happen: the preview is shown BEFORE anything is written, Apply is disabled when there is
 * nothing valid to write, blocked rows and their reasons are visible, the overwrite tick is
 * passed to the planner, and the report after writing distinguishes updated / refused /
 * nothing-to-change / database failures. No network: the module is mocked.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ops = vi.hoisted(() => ({
  exportVacanciesForFill: vi.fn(),
  fetchVacancyCurrentByIds: vi.fn(),
  readVacancySheet: vi.fn(),
  planVacancyRows: vi.fn(),
  applyVacancyPlans: vi.fn(),
}));
vi.mock("@/lib/utils/vacancyBulkOps", async () => {
  const actual = await vi.importActual< typeof import("@/lib/utils/vacancyBulkOps") >("@/lib/utils/vacancyBulkOps");
  return { ...actual, ...ops };
});

import { VacancyBulkFill } from "./VacancyBulkFill";

const ID = "11111111-1111-4111-8111-111111111111";
const plan = (over: Record<string, unknown> = {}) => ({
  rowNumber: 2, id: ID, slug: "up-swasthya-vibhag-ambulance-driver-2026",
  writes: { notification_date: "2026-10-01" }, skipped: [], errors: [], warnings: [], valid: true, ...over,
});
const counts = (rows: number, writable: number, blocked = 0, noChange = 0) => ({ rows, writable, blocked, noChange });

beforeEach(() => {
  vi.clearAllMocks();
  ops.exportVacanciesForFill.mockResolvedValue({ count: 361, filename: "x.xlsx" });
  ops.fetchVacancyCurrentByIds.mockResolvedValue(new Map());
  // The gate's parsed shape, exactly what readSpreadsheetUpload returns.
  ops.readVacancySheet.mockResolvedValue({
    upload: { kind: "xlsx", fileName: "filled.xlsx", bytes: 4, sheetName: "vacancies", rowCount: 2, dataRows: 1, rows: [{ id: ID }] },
    records: [{ id: ID, notification_date: "2026-10-01" }],
  });
  ops.planVacancyRows.mockReturnValue({ plans: [plan()], counts: counts(1, 1) });
  ops.applyVacancyPlans.mockResolvedValue({ updated: 1, refused: 0, untouched: 0, failures: [] });
});

/** jsdom will not accept a real FileList, so the files property is installed directly. */
function chooseFile(name = "filled.xlsx") {
  const input = screen.getByTestId("vacancy-file-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [new File(["x"], name)], configurable: true });
  fireEvent.change(input);
  return input;
}

describe("the card", () => {
  it("offers export, a file picker and the overwrite switch, and writes nothing on its own", () => {
    render(<VacancyBulkFill />);
    expect(screen.getByText("Bulk fill dates and links")).toBeTruthy();
    expect(screen.getByText("Export sheet")).toBeTruthy();
    expect(screen.getByTestId("vacancy-file-input")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Overwrite values that are already set/i })).toBeTruthy();
    expect(ops.applyVacancyPlans).not.toHaveBeenCalled();
    expect(screen.queryByTestId("vacancy-report")).toBeNull();
  });

  it("exports and says what the sheet contains", async () => {
    render(<VacancyBulkFill />);
    fireEvent.click(screen.getByText("Export sheet"));
    await waitFor(() => expect(ops.exportVacanciesForFill).toHaveBeenCalledTimes(1));
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("361 vacancy rows exported")));
  });
});

describe("preview before writing", () => {
  it("shows the row-level plan and only then offers Apply", async () => {
    const onDone = vi.fn();
    render(<VacancyBulkFill onImportComplete={onDone} />);
    chooseFile();
    await waitFor(() => expect(screen.getByText(/Preview of “filled.xlsx”/)).toBeTruthy());
    expect(ops.planVacancyRows).toHaveBeenCalledTimes(1);
    const row = screen.getByTestId("preview-row-2");
    expect(row.textContent).toContain("notification_date");
    expect(row.textContent).toContain("2026-10-01");
    expect(row.textContent).toContain("up-swasthya-vibhag-ambulance-driver-2026");
    expect(ops.applyVacancyPlans).not.toHaveBeenCalled();     // preview never writes

    fireEvent.click(screen.getByTestId("vacancy-apply"));
    await waitFor(() => expect(ops.applyVacancyPlans).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const first = await screen.findByTestId("vacancy-report");
    expect(first.textContent).toContain("1 updated");
  });

  it("passes the overwrite decision to the planner", async () => {
    render(<VacancyBulkFill />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Overwrite values that are already set/i }));
    chooseFile();
    await waitFor(() => expect(ops.planVacancyRows).toHaveBeenCalled());
    expect(ops.planVacancyRows.mock.calls[0][2]).toEqual({ overwrite: true });
  });

  it("shows blocked rows with their reason and refuses to apply when nothing is writable", async () => {
    ops.planVacancyRows.mockReturnValue({
      plans: [plan({ writes: {}, valid: false, errors: [`id 22222222… is not a vacancy row — nothing is created by an import`] })],
      counts: counts(1, 0, 1),
    });
    render(<VacancyBulkFill />);
    chooseFile();
    const apply = await screen.findByTestId("vacancy-apply");
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/nothing is created by an import/)).toBeTruthy();
    expect(screen.getByText(/0 will be written/)).toBeTruthy();
  });

  it("shows the warnings the planner raised, including the verification consequence", async () => {
    ops.planVacancyRows.mockReturnValue({
      plans: [plan({ warnings: ["last date 2026-01-10 is already past", "the database voids that verification — re-verify after this import"] })],
      counts: counts(1, 1),
    });
    render(<VacancyBulkFill />);
    chooseFile();
    await screen.findByText(/already past/);
    expect(screen.getByText(/re-verify after this import/)).toBeTruthy();
  });

  it("surfaces a rejected file from the shared gate instead of an empty preview", async () => {
    ops.readVacancySheet.mockRejectedValue(new Error('Unsupported file type ".txt". Import an .xlsx, .xls or .csv file exported from this CMS or from Excel.'));
    render(<VacancyBulkFill />);
    chooseFile("notes.txt");
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Unsupported file type")));
    expect(screen.queryByText(/Preview of/)).toBeNull();
    expect(ops.planVacancyRows).not.toHaveBeenCalled();
  });

  it("reports per-row database failures rather than claiming success", async () => {
    ops.applyVacancyPlans.mockResolvedValue({
      updated: 0, refused: 0, untouched: 0,
      failures: [{ row: 2, id: ID, message: "new row violates row-level security policy for table \"sarkari_naukri\"" }],
    });
    render(<VacancyBulkFill />);
    chooseFile();
    fireEvent.click(await screen.findByTestId("vacancy-apply"));
    const report = await screen.findByTestId("vacancy-report");
    expect(report.textContent).toContain("1 database failures");
    expect(report.textContent).toContain("row-level security");
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("1 row(s) failed to write"));
  });
});
