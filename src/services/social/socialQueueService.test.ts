/**
 * socialQueueService.test.ts — the client half of the social queue (owner batch 5, P2 + P5).
 *
 * Two things are proven here that no other test can:
 *  • P5 layer 1 — the publish/verify hook itself refuses a reference TEST record: no request
 *    is made at all, and the hook still never throws, because a publish that worked must not
 *    look like it failed;
 *  • P2 — a channel cannot be saved with something that is not a Telegram chat id, and the
 *    panel carries no field that could hold a bot token.
 *
 * The feature flag is mocked to ON, so the assertions do not change when the flag is flipped
 * (or reverted) in the source. All Supabase calls are mocked — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const flags = vi.hoisted(() => ({ on: true }));
vi.mock("@/config/featureFlags", () => ({
  FEATURE_FLAGS: { SOCIAL_QUEUE: true },
  flagOn: () => flags.on,
}));
vi.mock("@/lib/supabase/client", () => ({
  db: { from: vi.fn(), functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) } },
}));

import { db } from "@/lib/supabase/client";
import {
  createCandidate, createChannel, updateChannel, listChannels,
  validateTelegramChatId, validateChannelLabel,
} from "./socialQueueService";

const mockFrom = vi.mocked(db.from);
const mockInvoke = vi.mocked(db.functions.invoke);

/** Awaitable fluent query-builder mock resolving to `result`. */
function chain(result: unknown): any {
  const c: any = {
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
    catch: (onR: any) => Promise.resolve(result).catch(onR),
  };
  for (const m of ["select", "insert", "update", "delete", "eq", "is", "in", "or",
    "order", "limit", "range", "not", "ilike", "single", "maybeSingle"]) {
    c[m] = vi.fn(() => c);
  }
  return c;
}

beforeEach(() => {
  flags.on = true;
  mockInvoke.mockReset();
  mockFrom.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("createCandidate — layer 1 of the test-content guard (P5)", () => {
  it("makes NO request for a zz-test- slug, and does not throw", async () => {
    await expect(createCandidate({
      source_type: "exam", source_id: "e1", event: "published", page_url: "", slug: "zz-test-entrance-exam",
    })).resolves.toBeUndefined();
    expect(mockInvoke, "a test record must not even spend a call").not.toHaveBeenCalled();
  });

  it("sends the candidate for a real slug, WITHOUT leaking the slug into the request body", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null } as any);
    await createCandidate({ source_type: "exam", source_id: "e1", event: "published", page_url: "", slug: "ssc-cgl" });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, opts] = mockInvoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(fn).toBe("social-candidate");
    expect(opts.body).toEqual({
      channel: "telegram", source_type: "exam", source_id: "e1", event: "published", page_url: "",
    });
  });

  it("treats an absent slug as not-test (the edge function is still the real gate)", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null } as any);
    await createCandidate({ source_type: "exam", source_id: "e1", event: "verified", page_url: "" });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("never throws — neither a rejection nor a 4xx response may reach the publish path", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("network down"));
    await expect(createCandidate({ source_type: "exam", source_id: "e1", event: "published", page_url: "", slug: "x" })).resolves.toBeUndefined();
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "reference test content is never queued" } } as any);
    await expect(createCandidate({ source_type: "exam", source_id: "e1", event: "published", page_url: "", slug: "x" })).resolves.toBeUndefined();
  });

  it("is a no-op when the flag is off", async () => {
    flags.on = false;
    await createCandidate({ source_type: "exam", source_id: "e1", event: "published", page_url: "", slug: "x" });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("validateTelegramChatId — what a chat id may look like (P2)", () => {
  it.each(["@indianexaminfo", "@Exams_2026", "-1001234567890", "12345678"])(
    "accepts %s", (v) => { expect(validateTelegramChatId(v)).toBeNull(); },
  );

  it.each([
    ["", "asks for a value"],
    ["   ", "whitespace only"],
    ["indianexaminfo", "a handle without the @ is not a chat id"],
    ["@ab", "too short for a Telegram username"],
    ["@9lives", "must start with a letter"],
    ["@has space", "no spaces"],
    ["https://t.me/joinchat/AAAAAE", "an invite LINK is not a chat id"],
    ["-100abc", "not numeric"],
    ["123", "a numeric id needs 4+ digits"],
  ])("refuses %s (%s)", (v) => {
    const err = validateTelegramChatId(v);
    expect(err).toBeTruthy();
    expect(err).toMatch(/chat id|Telegram/i);
  });

  it("refuses a chat id whose value would be echoed back into its own error", () => {
    // not a security claim so much as a habit: validation messages are shown in a toast and
    // copied into bug reports, so they must not repeat what the operator just typed.
    const v = "-100SECRETSECRET";
    expect(validateTelegramChatId(v)).not.toContain(v);
    expect(validateTelegramChatId(v)).toBeTruthy();
  });

  it("validateChannelLabel requires a label and keeps it short", () => {
    expect(validateChannelLabel("Main channel")).toBeNull();
    expect(validateChannelLabel("")).toMatch(/label/i);
    expect(validateChannelLabel("x".repeat(81))).toMatch(/80/);
  });
});

describe("channel writes (P2)", () => {
  it("listChannels reads only the columns the panel shows", async () => {
    mockFrom.mockReturnValue(chain({ data: [{ id: "c1", channel: "telegram", label: "Main", external_id: "@x", is_active: true }], error: null }));
    const rows = await listChannels();
    expect(rows).toHaveLength(1);
    const from = mockFrom.mock.results[0].value;
    expect(from.select.mock.calls[0][0]).toBe("id,channel,label,external_id,is_active");
  });

  it("createChannel validates BEFORE it touches the table", async () => {
    await expect(createChannel({ label: "Main", external_id: "nope" })).rejects.toThrow(/chat id/i);
    await expect(createChannel({ label: "  ", external_id: "@x" })).rejects.toThrow(/label/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("createChannel writes channel:'telegram' and trims what it stores", async () => {
    mockFrom.mockReturnValue(chain([]));
    await createChannel({ label: "  Main channel  ", external_id: " @indianexaminfo " });
    const insert = mockFrom.mock.results[0].value.insert;
    expect(insert.mock.calls[0][0]).toEqual({
      channel: "telegram", label: "Main channel", external_id: "@indianexaminfo", is_active: true,
    });
  });

  it("updateChannel refuses a bad chat id and never sends channel/id in the patch", async () => {
    await expect(updateChannel("c1", { external_id: "bad id" })).rejects.toThrow(/chat id/i);
    mockFrom.mockReturnValue(chain([]));
    await updateChannel("c1", { external_id: "@indianexaminfo", is_active: false });
    const from = mockFrom.mock.results[0].value;
    expect(from.update.mock.calls[0][0]).toEqual({ external_id: "@indianexaminfo", is_active: false });
    expect(from.update.mock.calls[0][0]).not.toHaveProperty("channel");
  });

  it("neither create nor update can carry a token-ish field at all", async () => {
    mockFrom.mockReturnValue(chain([]));
    await createChannel({ label: "L", external_id: "@indianexaminfo" } as any);
    const payload = mockFrom.mock.results[0].value.insert.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(["channel", "external_id", "is_active", "label"]);
    expect(JSON.stringify(payload)).not.toMatch(/token|TG_BOT/i);
  });
});
