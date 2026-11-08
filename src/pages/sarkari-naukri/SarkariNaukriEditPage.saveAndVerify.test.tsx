/**
 * SarkariNaukriEditPage.saveAndVerify.test.tsx — owner batch 8, H2.
 * "Fill-then-verify in one flow".
 *
 * The point of this file is that the new "Save + Verify" button runs the EXISTING
 * path and nothing else: the same save, then the same verifySarkariNaukri call the
 * standalone Verify button makes. The database trigger trg_sarkari_verify is still
 * the authority, and a refusal has to reach the editor in plain words.
 *
 * Three things must stay true:
 *   1. Save + Verify saves FIRST and verifies SECOND (never the other way round).
 *   2. IT NEVER AUTO-VERIFIES. A plain "Save" must not touch verified_at, and a
 *      refused verification must leave the row unverified rather than half-done.
 *   3. A refusal is SHOWN, in the words the trigger's own message used.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/components/messages/OpenReportsBanner", () => ({ OpenReportsBanner: () => null }));

const session = vi.hoisted(() => ({ roleSlug: "super-admin", permissions: ["publish_post"] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u1", email: "e@x.in",
      profile: { name: "Owner", roleSlug: session.roleSlug, permissions: session.permissions },
    },
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
    recruitmentType: "direct", status: "upcoming", workflowStatus: "draft",
    notificationDate: "2026-10-01", applicationStartDate: "2026-10-05",
    applicationEndDate: "2026-11-30",
    officialNotificationUrl: "https://uphealth.up.gov.in/n.pdf", applicationUrl: "https://uphealth.up.gov.in/apply",
    vacancyCount: 120, examDate: null, admitCardDate: null, resultDate: null,
    description: "", eligibility: null, ageLimit: null, applicationFee: null,
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

describe("Save + Verify", () => {
  it("saves first and only then runs the existing verify path", async () => {
    const order: string[] = [];
    svc.updateSarkariNaukri.mockImplementation(async () => { order.push("save"); return {} as never; });
    svc.verifySarkariNaukri.mockImplementation(async () => {
      order.push("verify");
      return { ...vacancy(), verifiedAt: "2026-11-08T09:00:00Z" } as never;
    });
    mount(vacancy());

    const button = await screen.findByTestId("vacancy-save-and-verify");
    fireEvent.click(button);

    await waitFor(() => expect(svc.verifySarkariNaukri).toHaveBeenCalledWith(ID));
    expect(order).toEqual(["save", "verify"]);
    // The verify path is the existing one — it takes the row id and nothing else.
    expect(svc.verifySarkariNaukri.mock.calls[0]).toEqual([ID]);
  });

  it("marks the row verified after a successful run", async () => {
    svc.updateSarkariNaukri.mockResolvedValue({} as never);
    svc.verifySarkariNaukri.mockResolvedValue({
      ...vacancy(), verifiedAt: "2026-11-08T09:00:00Z",
    } as never);
    mount(vacancy());

    fireEvent.click(await screen.findByTestId("vacancy-save-and-verify"));

    await waitFor(() => {
      expect(screen.getByText(/Verified/)).toBeTruthy();
    });
    expect(screen.queryByText("Unverified")).toBeNull();
  });

  it("refuses in plain words and leaves the row UNVERIFIED when the trigger refuses", async () => {
    // The trigger's own wording: no official link / no end date / no permission.
    svc.updateSarkariNaukri.mockResolvedValue({} as never);
    svc.verifySarkariNaukri.mockRejectedValue(
      new Error("This vacancy cannot be verified yet: add the official notification link, the last date to apply, and make sure the application window is still open."),
    );
    mount(vacancy());

    fireEvent.click(await screen.findByTestId("vacancy-save-and-verify"));

    await waitFor(() => {
      expect(screen.getByText(/cannot be verified yet/)).toBeTruthy();
    });
    // It did NOT pretend the row is verified.
    expect(screen.getByText("Unverified")).toBeTruthy();
  });

  it("NEVER auto-verifies on a plain Save", async () => {
    svc.updateSarkariNaukri.mockResolvedValue({} as never);
    mount(vacancy());

    const save = await screen.findByRole("button", { name: "Save" });
    fireEvent.click(save);

    await waitFor(() => expect(svc.updateSarkariNaukri).toHaveBeenCalled());
    expect(svc.verifySarkariNaukri).not.toHaveBeenCalled();
  });

  it("does not call the database at all when a required field is missing", async () => {
    mount(vacancy({ title: "" }));
    const button = await screen.findByTestId("vacancy-save-and-verify");
    fireEvent.click(button);
    await waitFor(() => expect(svc.updateSarkariNaukri).not.toHaveBeenCalled());
    expect(svc.verifySarkariNaukri).not.toHaveBeenCalled();
  });
});
