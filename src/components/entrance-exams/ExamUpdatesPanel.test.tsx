// @vitest-environment jsdom
/**
 * ExamUpdatesPanel.test.tsx — D-P2 commit 3/4 UI. Renders the panel with a mocked
 * service + permission hook and pins the safety rules: it loads the exam's
 * updates, the Publish action is gated on publish_post (a draft-only role never
 * sees it), and the add form opens.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const svc = vi.hoisted(() => ({
  listExamUpdates: vi.fn().mockResolvedValue([]),
  createExamUpdate: vi.fn(),
  updateExamUpdate: vi.fn(),
  withdrawExamUpdate: vi.fn(),
  reorderExamUpdates: vi.fn(),
  UPDATE_KINDS: ["provisional", "final", "revised", "corrigendum", "withdrawn"],
}));
vi.mock("@/services/examUpdatesService", () => svc);

let canPublish = false;
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => canPublish }));

import { ExamUpdatesPanel } from "./ExamUpdatesPanel";

beforeEach(() => { vi.clearAllMocks(); svc.listExamUpdates.mockResolvedValue([]); canPublish = false; });

describe("ExamUpdatesPanel", () => {
  it("loads the exam's updates on mount", async () => {
    render(<ExamUpdatesPanel examId="ex1" examEditionId="ed1" pillar="government-exam" />);
    await waitFor(() => expect(svc.listExamUpdates).toHaveBeenCalledWith("ex1"));
    expect(screen.getByTestId("exam-updates-panel")).toBeTruthy();
  });

  it("a role WITHOUT publish_post can save a draft but never sees Publish", async () => {
    render(<ExamUpdatesPanel examId="ex1" />);
    fireEvent.click(screen.getByText(/Add update/i));
    await waitFor(() => expect(screen.getByTestId("updates-form")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Save draft/i })).toBeTruthy();
    // no Publish button in the form for a draft-only role
    expect(screen.queryByRole("button", { name: /^Publish$/ })).toBeNull();
  });

  it("a role WITH publish_post sees the Publish button", async () => {
    canPublish = true;
    render(<ExamUpdatesPanel examId="ex1" />);
    fireEvent.click(screen.getByText(/Add update/i));
    await waitFor(() => expect(screen.getByTestId("updates-form")).toBeTruthy());
    expect(screen.getByRole("button", { name: /^Publish$/ })).toBeTruthy();
  });

  it("a prefilled notice draft opens the form filled", async () => {
    render(<ExamUpdatesPanel examId="ex1" initialDraft={{ examId: "ex1", slug: "s", contentType: "admit-card", title: "PET admit card out", kind: "provisional", quickLinks: [{ label: "Download", url: "https://x/admit" }] } as never} />);
    await waitFor(() => expect(screen.getByTestId("updates-form")).toBeTruthy());
    expect((screen.getByPlaceholderText(/Update title/i) as HTMLInputElement).value).toBe("PET admit card out");
  });
});
