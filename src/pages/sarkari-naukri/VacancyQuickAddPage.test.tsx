/**
 * VacancyQuickAddPage.test.tsx — owner batch 8, H1.
 * "Quick add from notice": paste the notice -> deterministic extractors propose the
 * fields -> the editor accepts or edits each one -> a DRAFT is created.
 *
 * The rules this file protects, in the order they matter:
 *   1. ACCEPT WRITES TO THE FORM ONLY. Nothing reaches the database until the
 *      editor presses "Create draft".
 *   2. THE TWO URL INPUTS ARE THE FORM FIELDS. A URL typed in step 1 must arrive
 *      in the created row — otherwise the row can never pass the JobPosting
 *      checklist, because the official notification link is required before the
 *      database will verify a vacancy.
 *   3. IT CREATES A DRAFT. Never a published page.
 *   4. NO NEAR-DUPLICATE. A hit is shown as a link to the existing row and the
 *      create is refused.
 *   5. NO NETWORK SURFACE. The page never fetches a URL it was given.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "e@x.in", profile: { name: "Owner", roleSlug: "super-admin" } },
    permissions: ["create_post"], isLoading: false,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}));

vi.mock("@/services/regionService", () => ({
  getRegions: vi.fn(async () => [
    { slug: "all-india", label: "All India", kind: "national" },
    { slug: "uttar-pradesh", label: "Uttar Pradesh", kind: "state" },
  ]),
}));

const svc = vi.hoisted(() => ({
  createSarkariNaukri: vi.fn(),
  findVacancyDuplicates: vi.fn(),
}));
vi.mock("@/services/sarkariNaukriService", async () => {
  const actual = await vi.importActual("@/services/sarkariNaukriService");
  return { ...actual, ...svc };
});

const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { VacancyQuickAddPage } = await import("./VacancyQuickAddPage");

const NOTICE = [
  "Uttar Pradesh Police Constable Recruitment 2026",
  "",
  "Important Dates:",
  "Notification Date: 12.08.2026",
  "Online Application Starts: 20.08.2026",
  "Last Date to Apply: 15.09.2026",
  "",
  "Total No. of Posts: 5,244",
].join("\n");

const OFFICIAL_URL = "https://uppbpb.gov.in/notices/constable-2026.pdf";
const APPLY_URL = "https://uppbpb.gov.in/apply/constable-2026";

function mount() {
  return render(
    <MemoryRouter initialEntries={["/vacancies/quick-add"]}>
      <Routes>
        <Route path="/vacancies/quick-add" element={<VacancyQuickAddPage />} />
        <Route path="/vacancies/:id" element={<div>edit page</div>} />
        <Route path="/vacancies" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
const type = (id: string, value: string) => {
  const el = document.getElementById(id)!;
  fireEvent.change(el, { target: { value } });
};

/**
 * Fill the required fields of step 3 directly.
 * The regions list is loaded asynchronously, so the state select has no
 * options until it resolves — wait for the option before choosing it.
 */
async function fillRequiredFields() {
  await screen.findByRole("option", { name: "Uttar Pradesh" });
  type("quick-title", "Uttar Pradesh Police Constable Recruitment 2026");
  type("quick-slug", "up-police-constable-2026");
  type("quick-org", "UP Police Recruitment and Promotion Board");
  fireEvent.change(document.getElementById("quick-state")!, { target: { value: "uttar-pradesh" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.findVacancyDuplicates.mockResolvedValue([]);
  svc.createSarkariNaukri.mockResolvedValue({ id: "v1", slug: "up-police-constable-2026" });
});

describe("Quick add from notice", () => {
  it("Accept writes to the FORM only — nothing reaches the database", async () => {
    mount();
    fireEvent.change(screen.getByTestId("quick-add-notice"), { target: { value: NOTICE } });
    fireEvent.click(screen.getByRole("button", { name: /Extract the fields/i }));

    const list = await screen.findByTestId("quick-add-proposals");
    const item = Array.from(list.querySelectorAll("li")).find((li) =>
      /Notification date/i.test(li.textContent ?? ""),
    );
    expect(item).toBeTruthy();
    fireEvent.click(within(item as HTMLElement).getByRole("button", { name: "Accept" }));

    // The date landed in the form...
    expect(val("quick-notification-date")).toBe("2026-08-12");
    // ...and the database was NOT touched.
    expect(svc.createSarkariNaukri).not.toHaveBeenCalled();
  });

  it("shows the SOURCE LINE for every proposal", async () => {
    mount();
    fireEvent.change(screen.getByTestId("quick-add-notice"), { target: { value: NOTICE } });
    fireEvent.click(screen.getByRole("button", { name: /Extract the fields/i }));

    const list = await screen.findByTestId("quick-add-proposals");
    expect(list.textContent).toContain("Notification Date: 12.08.2026");
    expect(list.textContent).toContain("Last Date to Apply: 15.09.2026");
  });

  it("the two URL inputs in step 1 reach the created row", async () => {
    mount();
    type("quick-official-url", OFFICIAL_URL);
    type("quick-apply-url", APPLY_URL);
    await fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    await waitFor(() => expect(svc.createSarkariNaukri).toHaveBeenCalled());
    const payload = svc.createSarkariNaukri.mock.calls[0][0];
    expect(payload.officialNotificationUrl).toBe(OFFICIAL_URL);
    expect(payload.applicationUrl).toBe(APPLY_URL);
  });

  it("creates a DRAFT, never a published row", async () => {
    mount();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    await waitFor(() => expect(svc.createSarkariNaukri).toHaveBeenCalled());
    const payload = svc.createSarkariNaukri.mock.calls[0][0];
    expect(payload.workflowStatus).toBe("draft");
  });

  it("refuses a near-duplicate and points at the existing row", async () => {
    svc.findVacancyDuplicates.mockResolvedValue([
      {
        id: "existing-1",
        slug: "up-police-constable-2026",
        title: "UP Police Constable Recruitment 2026",
        state: "uttar-pradesh",
        workflowStatus: "published",
        reason: "slug",
      },
    ]);
    mount();
    await fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    await waitFor(() =>
      expect(screen.getByTestId("quick-add-duplicates")).toBeTruthy(),
    );
    expect(screen.getByText(/UP Police Constable Recruitment 2026/)).toBeTruthy();
    expect(svc.createSarkariNaukri).not.toHaveBeenCalled();
  });

  it("never fetches a URL — no new network surface", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      mount();
      type("quick-official-url", OFFICIAL_URL);
      fireEvent.change(screen.getByTestId("quick-add-notice"), { target: { value: NOTICE } });
      fireEvent.click(screen.getByRole("button", { name: /Extract the fields/i }));
      await screen.findByTestId("quick-add-proposals");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
