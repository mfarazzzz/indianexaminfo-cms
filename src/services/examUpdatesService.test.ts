/**
 * examUpdatesService.test.ts — D-P2 service layer. Mocked Supabase; no network.
 * Pins: sanitizeLinks (label+url only, javascript: dropped, deduped), the create
 * insert carries the update columns and defaults to DRAFT, withdraw keeps the
 * post published (kind only), reorder writes display_order in sequence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ db: { from: (...a: unknown[]) => mockFrom(...a) } }));
vi.mock("@/lib/utils", () => ({ sanitizeHtml: (s: string) => s }));

import {
  sanitizeLinks, createExamUpdate, withdrawExamUpdate, reorderExamUpdates, listExamUpdates,
} from "./examUpdatesService";

beforeEach(() => vi.clearAllMocks());

describe("sanitizeLinks", () => {
  it("keeps only label+url links, drops javascript: and de-dupes by url", () => {
    expect(sanitizeLinks([
      { label: "Apply", url: "https://x.gov.in/apply" },
      { label: "NoUrl" },
      { url: "https://y.gov.in" },
      { label: "bad", url: "javascript:alert(1)" },
      { label: "dup", url: "https://x.gov.in/apply" },
    ])).toEqual([{ label: "Apply", url: "https://x.gov.in/apply" }]);
  });
  it("a non-array is empty", () => {
    expect(sanitizeLinks(null)).toEqual([]);
  });
});

/** A chain that records the last insert/update payload and resolves single(). */
function chain(result: Record<string, unknown> = {}) {
  const cap: { insert?: Record<string, unknown>; updates: Record<string, unknown>[] } = { updates: [] };
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "single", "limit", "ilike"]) c[m] = vi.fn(() => c);
  c.insert = vi.fn((p: Record<string, unknown>) => { cap.insert = p; return c; });
  c.update = vi.fn((p: Record<string, unknown>) => { cap.updates.push(p); return c; });
  c.single = vi.fn().mockResolvedValue({ data: { id: "u1", ...result }, error: null });
  // awaiting the list chain resolves to { data: [], error: null }
  (c as any).then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
  mockFrom.mockImplementation(() => c);
  return cap;
}

const baseRow = {
  exam_id: "ex1", content_type: "admit-card", title: "Admit card out", content: "body",
  kind: "final", display_order: 2, status: "draft", created_at: "", updated_at: "",
};

describe("createExamUpdate", () => {
  it("writes the update columns and defaults to a DRAFT (never silent-publish)", async () => {
    const cap = chain(baseRow);
    const u = await createExamUpdate({ examId: "ex1", slug: "admit-card-out", contentType: "admit-card", title: "Admit card out", kind: "final", quickLinks: [{ label: "Download", url: "https://x/admit" }] });
    expect(cap.insert).toMatchObject({
      exam_id: "ex1", content_type: "admit-card", kind: "final", display_order: 0,
      status: "draft", published_at: null, quick_links: [{ label: "Download", url: "https://x/admit" }],
    });
    expect(u.kind).toBe("final");
  });

  it("an explicit publish sets published_at", async () => {
    const cap = chain(baseRow);
    await createExamUpdate({ examId: "ex1", slug: "s", contentType: "result", title: "t", status: "published" });
    expect(cap.insert!.status).toBe("published");
    expect(typeof cap.insert!.published_at).toBe("string");
  });
});

describe("withdrawExamUpdate", () => {
  it("sets kind='withdrawn' only — the post stays published", async () => {
    const cap = chain(baseRow);
    await withdrawExamUpdate("u1");
    expect(cap.updates[0]).toMatchObject({ kind: "withdrawn" });
    expect(cap.updates[0].status).toBeUndefined();
  });
});

describe("reorderExamUpdates", () => {
  it("writes display_order 0..n in the given sequence, scoped to the exam", async () => {
    const cap = chain();
    await reorderExamUpdates("ex1", ["a", "b", "c"]);
    expect(cap.updates.map((u) => u.display_order)).toEqual([0, 1, 2]);
  });
});

describe("listExamUpdates", () => {
  it("reads the exam's posts (returns mapped rows)", async () => {
    chain();
    const rows = await listExamUpdates("ex1");
    expect(Array.isArray(rows)).toBe(true);
  });
});
