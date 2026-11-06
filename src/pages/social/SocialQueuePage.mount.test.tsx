/**
 * SocialQueuePage.mount.test.tsx — owner batch 7, Phase S.
 *
 * The screen this file mounts is the one that showed "Failed to load this page" on the
 * deployed CMS. The cause was not the database and not a missing chunk: the router resolves
 * lazy pages by NAME (`lazyPage(() => import("…/SocialQueuePage"), "SocialQueuePage")`) and
 * the module only had `export default`, so React tried to render `undefined`. All 38 routes
 * are guarded statically by src/router/lazyExports.test.ts; THIS file is the runtime proof,
 * because it does the same dynamic import the router does and then really mounts the page
 * under a mocked session.
 *
 * Nothing here writes: the service layer is mocked, and no button is clicked — the owner's
 * rule for this screen (never trigger Add channel / Approve / Run due queue automatically).
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { SocialQueuePage } from "./SocialQueuePage";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flags = vi.hoisted(() => ({ SOCIAL_QUEUE: true as boolean }));
vi.mock("@/config/featureFlags", () => ({
  FEATURE_FLAGS: { SOCIAL_QUEUE: flags.SOCIAL_QUEUE },
  flagOn: (name: string) => name === "SOCIAL_QUEUE" && flags.SOCIAL_QUEUE,
}));

const session = vi.hoisted(() => ({ roleSlug: "super-admin", permissions: ["manage_social"] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-intern-1", email: "e@x.in", profile: { name: "Editor", roleSlug: session.roleSlug, permissions: session.permissions } },
    permissions: session.permissions,
    isLoading: false,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}));

const svc = vi.hoisted(() => ({
  listQueue: vi.fn(), getConfig: vi.fn(), listChannels: vi.fn(),
  decide: vi.fn(), setCaption: vi.fn(), setConfig: vi.fn(), runDueQueue: vi.fn(),
  createChannel: vi.fn(), updateChannel: vi.fn(), createCandidate: vi.fn(),
}));
vi.mock("@/services/social/socialQueueService", () => svc);

const POST = {
  id: "p1", status: "draft" as const, channel: "telegram",
  source_label: "SSC CGL 2026 — notification out", caption: "SSC CGL 2026 notification is out.",
  landing_url: "https://www.indianexaminfo.com/sarkari-naukri/ssc-exams/ssc-cgl",
  attempts: 0, scheduled_at: null, approved_at: null, error: null,
};
const CFG = { kill_switch: true, dry_run: true, telegram_daily_cap: 20 };
const CHANNEL = { id: "c1", channel: "telegram", label: "Main channel", external_id: "-1001234567890", is_active: true };

beforeEach(() => {
  vi.clearAllMocks();
  flags.SOCIAL_QUEUE = true;
  session.roleSlug = "super-admin";
  session.permissions = ["manage_social"];
  svc.listQueue.mockResolvedValue([POST]);
  svc.getConfig.mockResolvedValue(CFG);
  svc.listChannels.mockResolvedValue([CHANNEL]);
});

describe("the export shape the router depends on (the production bug)", () => {
  it("the module the router imports resolves to a component under the NAME it asks for", async () => {
    const m = await import("./SocialQueuePage");
    // lazyPage(() => import("./SocialQueuePage"), "SocialQueuePage") reads m.SocialQueuePage.
    // Before Phase S that key did not exist, and the screen rendered "Failed to load this page".
    expect(typeof m.SocialQueuePage, "named export SocialQueuePage must be a component").toBe("function");
    expect(typeof m.default, "default export kept as well").toBe("function");
    expect(m.default).toBe(m.SocialQueuePage);
  });

  it("the statically imported component is the same function", () => {
    expect(typeof SocialQueuePage).toBe("function");
  });
});

describe("mounts under a mocked session", () => {
  it("renders the queue, the safety banner and the channel the DB holds", async () => {
    render(<SocialQueuePage />);
    expect(await screen.findByText("Social queue — Telegram")).toBeTruthy();
    // the three mount reads really happened, in parallel, once
    await waitFor(() => {
      expect(svc.listQueue).toHaveBeenCalledTimes(1);
      expect(svc.getConfig).toHaveBeenCalledTimes(1);
      expect(svc.listChannels).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/KILL SWITCH ON/)).toBeTruthy();
    expect(screen.getByText("SSC CGL 2026 — notification out")).toBeTruthy();
    expect(screen.getByText("Main channel")).toBeTruthy();
    expect(screen.getByText("-1001234567890")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();
  });

  it("a super-admin gets the channel editor and live config checkboxes", async () => {
    render(<SocialQueuePage />);
    const add = await screen.findByText("Add channel");
    expect(add).toBeTruthy();
    const kill = screen.getByRole("checkbox", { name: /Kill switch/i }) as HTMLInputElement;
    expect(kill.disabled).toBe(false);
    expect(kill.checked).toBe(true);
  });

  it("any other role sees the queue but cannot edit config or channels", async () => {
    session.roleSlug = "editor";
    render(<SocialQueuePage />);
    await screen.findByText("Social queue — Telegram");
    expect(screen.queryByText("Add channel")).toBeNull();
    expect(screen.getByText(/Channels are added and edited by super-admin only/)).toBeTruthy();
    const kill = screen.getByRole("checkbox", { name: /Kill switch/i }) as HTMLInputElement;
    expect(kill.disabled).toBe(true);
  });

  it("an empty queue explains itself instead of crashing on no rows", async () => {
    svc.listQueue.mockResolvedValue([]);
    svc.listChannels.mockResolvedValue([]);
    render(<SocialQueuePage />);
    expect(await screen.findByText(/Nothing in the queue/)).toBeTruthy();
    expect(screen.getByText(/No channel configured yet/)).toBeTruthy();
  });

  it("a failed read surfaces as a toast, not as a broken page", async () => {
    svc.listQueue.mockRejectedValue(new Error("permission denied for social_posts"));
    const { toast } = await import("sonner");
    render(<SocialQueuePage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("permission denied for social_posts"));
    // the shell still renders
    expect(screen.getByText("Social queue — Telegram")).toBeTruthy();
  });
});

describe("with the feature flag off", () => {
  it("renders the disabled screen and touches no database at all", async () => {
    flags.SOCIAL_QUEUE = false;
    render(<SocialQueuePage />);
    expect(await screen.findByText(/Disabled by/)).toBeTruthy();
    expect(svc.listQueue).not.toHaveBeenCalled();
    expect(svc.getConfig).not.toHaveBeenCalled();
    expect(svc.listChannels).not.toHaveBeenCalled();
  });
});
