/**
 * Sidebar.nav.test.ts — Phase Y (U2 step 1): the rail's shape and its per-role behaviour.
 *
 * Two things are pinned here:
 *   1. the seven exam-ish lists now live in ONE group called "Sarkari Naukri", each with the
 *      label, path and permission slugs it had before, and "Vacancy Pages" is now
 *      "Vacancy listings" — a relabel, not a re-route;
 *   2. what each role actually sees, computed by the same filter the component uses, against the
 *      REAL permission sets read from the live database today (the query is quoted below).
 *
 * A rendered check follows the data checks, because the mobile drawer is the SAME component —
 * if the grouping were only right in the data, a second mobile-only list could still drift.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "e@x.in", profile: { name: "Faraz", roleSlug: "admin", permissions: auth.permissions } },
    permissions: auth.permissions,
    isLoading: false,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}));
vi.mock("@/contexts/MobileNavContext", () => ({
  useMobileNav: () => ({ sidebarOpen: false, setSidebarOpen: vi.fn() }),
}));
vi.mock("@/hooks/useNewMessageCount", () => ({ useNewMessageCount: () => 0 }));

import { NAV_GROUPS, Sidebar, canSeeItemWith, canSeeGroupWith, visibleNavGroups } from "./Sidebar";

/**
 * Permission slugs per role, exactly as returned today by:
 *   select r.slug, array_agg(p.slug order by p.slug) as perms
 *   from roles r left join role_permissions rp on rp.role_id = r.id
 *   left join permissions p on p.id = rp.permission_id
 *   where r.slug in ('super-admin','admin','editor','writer','viewer') group by r.slug;
 * (run 2026-11-06; counts 24 / 22 / 14 / 3 / 0)
 */
const ROLE: Record<string, string[]> = {
  "super-admin": [
    "create_exam", "create_post", "delete_exam", "delete_media", "delete_post", "edit_any_exam",
    "edit_any_post", "edit_own_post", "handle_messages", "manage_ad_zones", "manage_ads",
    "manage_categories", "manage_menus", "manage_pages", "manage_roles", "manage_settings",
    "manage_social", "manage_users", "publish_exam", "publish_post", "upload_media",
    "view_analytics", "view_audit_log", "view_own_ads",
  ],
  admin: [
    "create_exam", "create_post", "delete_exam", "delete_media", "delete_post", "edit_any_exam",
    "edit_any_post", "edit_own_post", "handle_messages", "manage_ad_zones", "manage_ads",
    "manage_categories", "manage_menus", "manage_pages", "manage_settings", "manage_users",
    "publish_exam", "publish_post", "upload_media", "view_analytics", "view_audit_log",
    "view_own_ads",
  ],
  editor: [
    "create_exam", "create_post", "delete_post", "edit_any_exam", "edit_any_post", "edit_own_post",
    "handle_messages", "manage_categories", "manage_menus", "manage_pages", "publish_exam",
    "publish_post", "upload_media", "view_analytics",
  ],
  writer: ["create_post", "edit_own_post", "upload_media"],
  viewer: [],
};

const group = (title: string) => NAV_GROUPS.find((g) => g.title === title);
const labels = (title: string) => (group(title)?.items ?? []).map((i) => i.label);
const visibleLabels = (role: string) =>
  visibleNavGroups(ROLE[role]).flatMap((g) => g.items.map((i) => i.label));

describe("the Sarkari Naukri group (U2 step 1)", () => {
  it("exists, in the position the Content group used to occupy in the reader's mental model", () => {
    expect(group("Sarkari Naukri"), "the new group").toBeDefined();
    const titles = NAV_GROUPS.map((g) => g.title);
    expect(titles).toEqual(["Overview", "Content", "Sarkari Naukri", "Structure", "Media", "Ad Manager", "Users", "System"]);
  });

  it("holds the seven exam-shaped lists, in this order", () => {
    expect(labels("Sarkari Naukri")).toEqual([
      "Entrance Exams", "Govt Exams", "Govt Vacancy Exams", "Board Exams", "University Exams",
      "Needs Verification", "Vacancy listings",
    ]);
  });

  it("moved them OUT of Content, which keeps only the non-exam items", () => {
    expect(labels("Content")).toEqual(["Dashboard", "Content", "Blog Authors", "Messages", "Social queue"]);
    for (const moved of ["Entrance Exams", "Govt Exams", "Govt Vacancy Exams", "Board Exams", "University Exams", "Needs Verification", "Vacancy listings"]) {
      expect(labels("Content"), `${moved} must no longer be in Content`).not.toContain(moved);
    }
  });

  it("changed nothing but the group and one label: paths and permission slugs are the old ones", () => {
    const expected: Record<string, { to: string; permissions: string[] }> = {
      "Entrance Exams": { to: "/entrance-exams", permissions: ["create_exam", "edit_any_exam"] },
      "Govt Exams": { to: "/govt-exam", permissions: ["create_exam", "edit_any_exam"] },
      "Govt Vacancy Exams": { to: "/govt-vacancy", permissions: ["create_exam", "edit_any_exam"] },
      "Board Exams": { to: "/board-exams", permissions: ["create_exam", "edit_any_exam"] },
      "University Exams": { to: "/university-exams", permissions: ["create_exam", "edit_any_exam"] },
      "Needs Verification": { to: "/needs-verification", permissions: ["create_exam", "edit_any_exam"] },
      // the only rename in this change: same path, same gates, new words
      "Vacancy listings": { to: "/vacancies", permissions: ["create_post", "edit_any_post", "edit_own_post"] },
    };
    for (const [label, want] of Object.entries(expected)) {
      const item = group("Sarkari Naukri")?.items.find((i) => i.label === label);
      expect(item, label).toBeDefined();
      expect(item!.to, `${label} path`).toBe(want.to);
      expect(item!.permissions, `${label} permissions`).toEqual(want.permissions);
    }
    // and the old label is gone from the whole rail
    expect(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label))).not.toContain("Vacancy Pages");
  });

  it("the group itself is not permission-gated, so it shows whenever any item in it does", () => {
    expect(group("Sarkari Naukri")!.permissions ?? []).toHaveLength(0);
    expect(canSeeGroupWith([], group("Sarkari Naukri")!)).toBe(true);
  });
});

describe("what each role actually sees", () => {
  it("super-admin: everything, including the social queue", () => {
    const seen = visibleLabels("super-admin");
    expect(seen).toContain("Social queue");
    expect(seen).toContain("Vacancy listings");
    expect(seen).toContain("User Management");
    expect(seen).toContain("Audit Log");
    expect(NAV_GROUPS.filter((g) => canSeeGroupWith(ROLE["super-admin"], g)).map((g) => g.title))
      .toEqual(NAV_GROUPS.map((g) => g.title));
  });

  it("admin: everything except the social queue, because only super-admin holds manage_social", () => {
    const seen = visibleLabels("admin");
    expect(seen).not.toContain("Social queue");
    expect(seen).toContain("Vacancy listings");
    expect(seen).toContain("User Management");
  });

  it("editor: the whole Sarkari Naukri group, no users, no system, no ads", () => {
    const titles = visibleNavGroups(ROLE.editor).map((g) => g.title);
    expect(titles).toContain("Sarkari Naukri");
    expect(titles).not.toContain("Users");
    expect(titles).not.toContain("System");
    expect(titles).not.toContain("Ad Manager");
    const seen = visibleLabels("editor");
    expect(seen).toEqual(expect.arrayContaining([
      "Entrance Exams", "Govt Exams", "Govt Vacancy Exams", "Board Exams", "University Exams",
      "Needs Verification", "Vacancy listings",
    ]));
    expect(seen).not.toContain("Social queue");
  });

  it("writer: one item of the group — Vacancy listings — and none of the exam lists", () => {
    const seen = visibleLabels("writer");
    expect(seen).toContain("Vacancy listings");
    expect(seen).not.toContain("Entrance Exams");
    expect(seen).not.toContain("Needs Verification");
    const sn = visibleNavGroups(ROLE.writer).find((g) => g.title === "Sarkari Naukri");
    expect(sn?.items.map((i) => i.label)).toEqual(["Vacancy listings"]);
  });

  it("viewer (no permissions at all): only the items that are not gated", () => {
    const seen = visibleLabels("viewer");
    expect(seen).toEqual(["Dashboard"]);
    expect(visibleNavGroups(ROLE.viewer).map((g) => g.title)).toEqual(["Content"]);
  });

  it("an item with no permissions list is visible to everyone, and 'some' not 'every' is the rule", () => {
    expect(canSeeItemWith([], { label: "x", to: "/x", icon: null })).toBe(true);
    expect(canSeeItemWith(["create_post"], { label: "x", to: "/x", icon: null, permissions: ["create_exam", "create_post"] })).toBe(true);
    expect(canSeeItemWith(["create_exam"], { label: "x", to: "/x", icon: null, permissions: ["create_exam", "create_post"] })).toBe(true);
    expect(canSeeItemWith(["upload_media"], { label: "x", to: "/x", icon: null, permissions: ["create_exam", "create_post"] })).toBe(false);
  });
});

describe("rendered rail (the same DOM serves the desktop column and the mobile drawer)", () => {
  beforeEach(() => { auth.permissions = ROLE.editor; });

  it("shows the Sarkari Naukri heading and the seven links", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sarkari Naukri")).toBeInTheDocument();
    for (const label of ["Entrance Exams", "Govt Exams", "Govt Vacancy Exams", "Board Exams",
      "University Exams", "Needs Verification", "Vacancy listings"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}$`) }), label).toBeInTheDocument();
    }
    expect(screen.queryByText("Vacancy Pages")).toBeNull();
    expect(screen.queryByText("Social queue")).toBeNull();   // editor has no manage_social
  });

  it("for a writer, the group is there with exactly one link in it", () => {
    auth.permissions = ROLE.writer;
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sarkari Naukri")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Vacancy listings$/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Entrance Exams$/ })).toBeNull();
  });
});
