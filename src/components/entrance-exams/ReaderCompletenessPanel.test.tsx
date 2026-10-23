/**
 * @vitest-environment jsdom
 * ReaderCompletenessPanel.test.tsx — P2 item 15: the panel's shape, from the reader's
 * point of view. Collapsed until asked, the work first, and a Fix button that names
 * the tab it is about to open — the panel is a diagnosis, and the editor must be able
 * to act on it without hunting for the control.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderCompletenessPanel } from "./ReaderCompletenessPanel";
import type { ReaderCompletenessRow } from "@/lib/exams/readerCompleteness";
import { TAB_LABELS } from "@/pages/entrance-exams/editorSections";

const rows: ReaderCompletenessRow[] = [
  { key: "important-dates", label: "Important dates table", status: "filled", fixHint: "Renders every row the edition stores.", targetTab: "edition" },
  { key: "eligibility", label: "Eligibility", status: "empty", fixHint: "Fill the Eligibility card on the Modules tab.", targetTab: "modules", focusKey: "eligibility" },
  { key: "how-to-steps", label: "How-to steps", status: "blocked", fixHint: "Application Process is switched off in the Modules tab.", targetTab: "modules", focusKey: "application-process" },
  { key: "vacancy", label: "Vacancy", status: "n/a", fixHint: "Not a reader section for this pillar — nothing to fill.", targetTab: "edition" },
];

describe("ReaderCompletenessPanel", () => {
  it("is COLLAPSED by default: the summary line is the whole resting state", () => {
    render(<ReaderCompletenessPanel rows={rows} onJump={() => {}} />);
    expect(screen.getByText("What readers will see")).toBeInTheDocument();
    expect(screen.getByText("1 filled · 1 empty · 1 blocked · 1 n/a")).toBeInTheDocument();
    // no rows are painted until it is opened
    expect(screen.queryByTestId("reader-row-eligibility")).toBeNull();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByTestId("reader-row-eligibility")).toBeInTheDocument();
  });

  it("lists the rows that need work BEFORE the ones that do not", () => {
    render(<ReaderCompletenessPanel rows={rows} onJump={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const order = screen.getAllByRole("listitem").map((li) => li.getAttribute("data-testid"));
    expect(order.slice(0, 2)).toEqual(["reader-row-how-to-steps", "reader-row-eligibility"]);
    expect(order[order.length - 1]).toBe("reader-row-important-dates");
  });

  it("only a row that can be fixed gets a Fix button, and it jumps to the tab + field it names", () => {
    const onJump = vi.fn();
    render(<ReaderCompletenessPanel rows={rows} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    // filled + n/a rows get no button (nothing to fix)
    expect(screen.queryByTestId("reader-fix-important-dates")).toBeNull();
    expect(screen.queryByTestId("reader-fix-vacancy")).toBeNull();
    fireEvent.click(screen.getByTestId("reader-fix-eligibility"));
    expect(onJump).toHaveBeenCalledWith("modules", "eligibility");
  });

  it("the Fix tooltip uses the SAME tab label the rail and the tab strip show", () => {
    render(<ReaderCompletenessPanel rows={rows} onJump={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByTestId("reader-fix-eligibility").getAttribute("title")).toContain(TAB_LABELS.modules);
    expect(screen.getByTestId("reader-fix-how-to-steps").getAttribute("title")).toContain(TAB_LABELS.modules);
  });

  it("shows how many rows still need work, in the collapsed header", () => {
    render(<ReaderCompletenessPanel rows={rows} onJump={() => {}} />);
    expect(screen.getByTestId("reader-needs-work")).toHaveTextContent("2 to fix");
  });

  it("renders nothing when there are no rows (the record is still loading)", () => {
    const { container } = render(<ReaderCompletenessPanel rows={[]} onJump={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
