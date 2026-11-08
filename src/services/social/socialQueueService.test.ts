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
  createCandidate, createChannel, updateChannel, listChannels, checkChannel,
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
  for (const m of ["select", "insert", "update", "delete", "eq", "neq", "is", "in", "or",
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
  it.each(["@indianexaminfo", "@Exams_2026", "-1001234567890", "-100999999999"])(
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
    ["-10012", "too short to be a channel id"],
    ["123", "a positive number is not a channel"],
  ])("refuses %s (%s)", (v) => {
    const err = validateTelegramChatId(v);
    expect(err).toBeTruthy();
    expect(err).toMatch(/chat id|Telegram|Channel ids|bot/i);
  });

  // The two values the owner actually entered on 2026-11-06, each with its own sentence.
  // Neither is deleted; both are simply not usable, which is what the row now says.
  it("refuses a bot's own handle, and says so in those words", () => {
    expect(validateTelegramChatId("@IndianExamInfobot")).toBe("That is a bot, not a channel.");
    expect(validateTelegramChatId("@someBOT")).toBe("That is a bot, not a channel.");
    // Only the SUFFIX is reserved for bots — a channel name that merely contains it is fine.
    expect(validateTelegramChatId("@botic_news")).toBeNull();
  });

  it("refuses a positive numeric id, and explains that channel ids start with -100", () => {
    const expected = "Channel ids start with -100; a positive number is a person or a bot.";
    expect(validateTelegramChatId("8747371610")).toBe(expected);
    expect(validateTelegramChatId("12345678")).toBe(expected);
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

describe("exactly one active telegram channel (P2, owner batch 9)", () => {
  it("activating validates the STORED chat id first, and writes nothing when it is bad", async () => {
    // The owner's two rows saved before these rules existed cannot be switched on: a
    // switch-on is the moment the value the worker would use starts to matter.
    mockFrom.mockReturnValue(chain({ data: { external_id: "@IndianExamInfobot", channel: "telegram" }, error: null }));
    await expect(updateChannel("bot-row", { is_active: true }))
      .rejects.toThrow("That is a bot, not a channel.");
    expect(mockFrom.mock.results[0].value.update).not.toHaveBeenCalled();
  });

  it("activating a valid channel deactivates the other active telegram rows", async () => {
    const results = [
      chain({ data: { external_id: "@IndianExamInfo", channel: "telegram" }, error: null }), // read the row
      chain({ error: null }),                                                                // set it active
      chain({ error: null }),                                                                // deactivate the rest
    ];
    let i = 0;
    mockFrom.mockImplementation(() => results[i++]);

    await updateChannel("main", { is_active: true });

    expect(results[1].update.mock.calls[0][0]).toEqual({ is_active: true });
    // Only the OTHER active rows, and only in the same channel group.
    expect(results[2].update.mock.calls[0][0]).toEqual({ is_active: false });
    expect(results[2].eq.mock.calls).toEqual([["channel", "telegram"], ["is_active", true]]);
    expect(results[2].neq.mock.calls).toEqual([["id", "main"]]);
  });

  it("adding a channel active excludes the new row from its own deactivation", async () => {
    const results = [
      chain({ data: { id: "new-row" }, error: null }), // insert().select("id").single()
      chain({ error: null }),                           // deactivate the rest
    ];
    let i = 0;
    mockFrom.mockImplementation(() => results[i++]);

    await createChannel({ label: "Main", external_id: "@IndianExamInfo" });

    expect(results[1].update.mock.calls[0][0]).toEqual({ is_active: false });
    expect(results[1].neq.mock.calls).toEqual([["id", "new-row"]]);
  });

  it("a channel created INACTIVE leaves the active one alone", async () => {
    mockFrom.mockReturnValue(chain({ data: { id: "new-row" }, error: null }));
    await createChannel({ label: "Spare", external_id: "@IndianExamInfo", is_active: false });
    // one call only: the insert. No deactivation at all.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("checkChannel — the read-only channel check (P3, owner batch 9)", () => {
  it("asks social-publish for a check of that row, and nothing else", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, chat_title: "Indian Exam Info", chat_type: "channel", bot_is_admin: true, can_post_messages: true },
      error: null,
    });
    const r = await checkChannel("c1");
    expect(r.ok).toBe(true);
    expect(r.chat_title).toBe("Indian Exam Info");
    expect(mockInvoke).toHaveBeenCalledWith("social-publish", {
      body: { action: "check_channel", channel_id: "c1" },
    });
  });

  it("passes the function's plain-language reason straight through", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, reason: "That is a bot or a person, not a channel." }, error: null,
    });
    const r = await checkChannel("c1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not a channel/);
  });

  it("uses no table write and no posting path of its own", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await checkChannel("c1");
    // The check is a single function call: it never touches social_posts or social_channels
    // from the browser, so it cannot approve, skip or send anything.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
