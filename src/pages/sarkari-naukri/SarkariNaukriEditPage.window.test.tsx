/**
 * SarkariNaukriEditPage.window.test.tsx — owner batch 7, C2a. The one-screen checklist.
 *
 * Before this change the three dates sat at the top of the vacancy editor and the two links
 * that verification also requires sat ~200 lines below, past the Verify button — so the
 * screen asked for the job in an order the database refuses. The migration
 * 20260927140000_sarkari_verification_trigger (trg_sarkari_verify) rejects verification
 * without an application_end_date and an http(s) official_notification_url, and
 * buildSarkariJobPostingSchema needs notification + end date + verified_at + the official
 * link. This file pins that all five inputs plus the verification state now live in ONE
 * card, in fill order, with a live checklist — and that the links really left the old
 * card rather than being duplicated.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/messages/OpenReportsBanner", () => ({ OpenReportsBanner: () => null }));

const session = vi.hoisted(() => ({ roleSlug: "super-admin", permissions: ["publish_post"] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "e@x.in", profile: { name: "Owner", roleSlug: session.roleSlug, permissions: session.permissions } },
    permissions: session.permissions, isLoading: false,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}));
vi.mock("@/services/regionService", () => ({
  getRegions: vi.fn(async () => [{ slug: "all-india", label: "All India", kind: "national" }]),
}));

const svc = vi.hoisted(() => ({
  getSarkariNaukriById: vi.fn(), createSarkariNaukri: vi.fn(), updateSarkariNaukri: vi.fn(),
  deleteSarkariNaukri: vi.fn(), verifySarkariNaukri: vi.fn(),
}));
vi.mock("@/services/sarkariNaukriService", async () => {
  const actual = await vi.importActual("@/services/sarkariNaukriService");
  return { ...actual, ...svc };
});

const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { SarkariNaukriEditPage } = await import("./SarkariNaukriEditPage");

const ID = "11111111-1111-4111-8111-111111111111";

function vacancy(over: Record<string, unknown> = {}) {
  return {
    id: ID, slug: "up-swasthya-vibhag-ambulance-driver-2026",
    title: "UP Swasthya Vibhag Ambulance Driver Bharti 2026",
    organization: "UP Directorate of Health", state: "uttar-pradesh", category: "health",
    recruitmentType: "direct", status: "completed", workflowStatus: "published",
    notificationDate: null, applicationStartDate: null, applicationEndDate: null,
    officialNotificationUrl: null, applicationUrl: null, vacancyCount: null,
    examDate: null, admitCardDate: null, resultDate: null, description: "", eligibility: null,
    verifiedAt: null, createdAt: "2026-07-05", updatedAt: "2026-09-28", ...over,
  };
}

function mount(item: Record<string, unknown>) {
  svc.getSarkariNaukriById.mockResolvedValue(item as never);
  return render(
    <MemoryRouter initialEntries={[`/vacancies/${ID}`]}>
      <Routes>
        <Route path="/vacancies/:id" element={<SarkariNaukriEditPage />} />
        <Route path="/vacancies" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("the vacancy window card", () => {
  it("holds all five fillable fields plus verification, in one card", async () => {
    mount(vacancy());
    const heading = await screen.findByRole("heading", { name: "Vacancy window" });
    const card = heading.closest("div.rounded-lg") as HTMLElement;
    for (const label of ["Notification Date", "Application Start", "Application End (Last Date)",
                         "Official Notification URL", "Application URL"]) {
      const inCard = Array.from(card.querySelectorAll("label")).some((l) => l.textContent?.trim() === label);
      expect(inCard, `"${label}" must be inside the Vacancy window card`).toBe(true);
    }
    // one input per label, no duplicates anywhere else on the page
    expect(Array.from(card.querySelectorAll("input")).filter((i) => i.type === "date")).toHaveLength(3);
    const urls = screen.getAllByText("Official Notification URL");
    expect(urls).toHaveLength(1);
    expect(screen.getAllByText("Application URL")).toHaveLength(1);
  });

  it("lists the seven checks in fill order and reports what is missing", async () => {
    mount(vacancy());
    const list = await screen.findByTestId("vacancy-checklist");
    const items = Array.from(list.querySelectorAll("li")).map((li) => li.textContent?.trim());
    // Owner batch 8, H2 — "Window open today" joins the list. A row whose window has
    // closed still tells the reader a last date, but it is NOT a live job listing,
    // so the open-today state is its own check rather than a detail of the dates.
    expect(items).toEqual([
      "○ Notification date", "○ Application start", "○ Last date to apply",
      "○ Window open today",
      "○ Official notification link", "○ Application link", "○ Verified against the notice",
    ]);
  });

  it("keeps 'Window open today' unfilled when the window has already closed", async () => {
    // A closed window is the normal state of an old row: every other check can be
    // green while this one stays open, because the dates are there but the job is over.
    mount(vacancy({
      notificationDate: "2026-01-10", applicationStartDate: "2026-01-15",
      applicationEndDate: "2026-02-20",
      officialNotificationUrl: "https://uphealth.up.gov.in/n.pdf",
      applicationUrl: "https://uphealth.up.gov.in/apply",
      verifiedAt: "2026-01-11T09:00:00Z",
    }));
    const list = await screen.findByTestId("vacancy-checklist");
    const items = Array.from(list.querySelectorAll("li")).map((li) => li.textContent?.trim());
    const open = items.find((t) => t?.includes("Window open today"));
    expect(open, "the open-today check must be present").toBeTruthy();
    expect(open?.startsWith("○"), "a closed window is NOT open today").toBe(true);
    // The other checks are unaffected by the closed window.
    expect(items.filter((t) => t?.startsWith("✓")).length).toBe(6);
  });

  it("turns a check green the moment its field is filled — live, before saving", async () => {
    mount(vacancy());
    const official = await screen.findByLabelText("Official Notification URL");
    fireEvent.change(official, { target: { value: "https://uphealth.up.gov.in/n.pdf" } });
    await waitFor(() => {
      const items = Array.from(screen.getByTestId("vacancy-checklist").querySelectorAll("li"));
      const li = items.find((i) => i.textContent?.includes("Official notification link"));
      expect(li?.textContent?.trim().startsWith("✓")).toBe(true);
    });
  });

  it("reports a fully filled and verified row as complete", async () => {
    mount(vacancy({
      notificationDate: "2026-10-01", applicationStartDate: "2026-10-05", applicationEndDate: "2026-11-30",
      officialNotificationUrl: "https://uphealth.up.gov.in/n.pdf", applicationUrl: "https://uphealth.up.gov.in/apply",
      verifiedAt: "2026-10-02T09:00:00Z",
    }));
    const list = await screen.findByTestId("vacancy-checklist");
    expect(Array.from(list.querySelectorAll("li")).every((li) => li.textContent?.trim().startsWith("✓"))).toBe(true);
  });

  it("puts the card before the recruitment-type toggle and before the Verify control", async () => {
    mount(vacancy());
    await screen.findByRole("heading", { name: "Vacancy window" });
    const html = document.body.innerHTML;
    const windowIdx = html.indexOf("Vacancy window");
    const toggleIdx = html.indexOf("Recruitment Type");
    const verifyIdx = html.indexOf("Verify against official notification");
    expect(windowIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(windowIdx);
    expect(verifyIdx).toBeGreaterThan(windowIdx);
  });

  it("says where the moved links went, so the old card is not just an empty box", async () => {
    mount(vacancy());
    await screen.findByText(/now live above, in/);
    expect(screen.getByText("Links")).toBeTruthy();
  });
});
