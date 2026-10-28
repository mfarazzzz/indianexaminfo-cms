/**
 * draftBackup.test.ts — the browser draft backup must NEVER be able to break the editor.
 * Every test below is about a storage that misbehaves (absent, throwing, quota, corrupt, expired)
 * and what the caller gets instead: a boolean, a null, or no prompt. Node (no window) is the
 * server case the module also has to survive.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  askRestore, clearDraftBackup, DEFAULT_DRAFT_TTL_MS, draftKey, isFresh, listDraftKeys,
  loadDraftBackup, saveDraftBackup, storageFor, type DraftEnvelope,
} from "./draftBackup";

/** A localStorage that behaves, plus the knobs to make it misbehave. */
class FakeStorage {
  private map = new Map<string, string>();
  throwOnSet = false;
  throwOnGet = false;
  denyAccess = false;

  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) {
    if (this.denyAccess) throw new Error("SecurityError: storage access denied");
    if (this.throwOnGet) throw new Error("boom");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.denyAccess) throw new Error("SecurityError: storage access denied");
    if (this.throwOnSet) { const e = new Error("QuotaExceededError"); (e as { name?: string }).name = "QuotaExceededError"; throw e; }
    this.map.set(k, v);
  }
  removeItem(k: string) { if (!this.throwOnGet) this.map.delete(k); }
  clear() { this.map.clear(); }
  /** Raw peek for the assertions that must not go through the module's own guards. */
  peek(k: string) { return this.map.get(k) ?? null; }
  has(k: string) { return this.map.has(k); }
}

let store: FakeStorage;
const NOW = 1_700_000_000_000;
const now = () => NOW;

beforeEach(() => {
  store = new FakeStorage();
  vi.stubGlobal("window", { localStorage: store } as unknown as Window & typeof globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("availability — no storage is a normal state, not an error", () => {
  it("returns null when there is no window at all (server / Node)", () => {
    // This suite runs in jsdom, so `window` genuinely exists; the module's own guard is
    // `typeof window === "undefined"`, and stubbing it to undefined is what a Node render
    // looks like from inside. A window WITHOUT localStorage (some embedded webviews) is the
    // second half of the same contract, asserted next.
    vi.stubGlobal("window", undefined);
    expect(storageFor()).toBeNull();
    expect(saveDraftBackup("e1", "general", { a: 1 })).toBe(false);
    expect(loadDraftBackup("e1", "general")).toBeNull();
    expect(() => clearDraftBackup("e1", "general")).not.toThrow();
    expect(listDraftKeys()).toEqual([]);
  });

  it("returns null when the window has no localStorage", () => {
    vi.stubGlobal("window", {});
    expect(storageFor()).toBeNull();
    expect(saveDraftBackup("e1", "general", "x")).toBe(false);
    expect(loadDraftBackup("e1", "general")).toBeNull();
  });

  it("returns null when the getter itself throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage { throw new Error("SecurityError"); },
    });
    expect(storageFor()).toBeNull();
  });

  it("survives a storage that throws on ACCESS (private mode, denied frame)", () => {
    store.denyAccess = true;
    expect(saveDraftBackup("e1", "general", "text")).toBe(false);
    expect(loadDraftBackup("e1", "general")).toBeNull();
    expect(() => clearDraftBackup("e1", "general")).not.toThrow();
  });

  it("survives a QUOTA failure and still reports 'not backed up'", () => {
    store.throwOnSet = true;
    expect(saveDraftBackup("e1", "general", "a long notice body")).toBe(false);
  });

  it("survives a storage that throws on READ", () => {
    saveDraftBackup("e1", "general", "fine");
    store.throwOnGet = true;
    expect(loadDraftBackup("e1", "general")).toBeNull();
    expect(() => clearDraftBackup("e1", "general")).not.toThrow();
  });
});

describe("keys and scoping", () => {
  it("scopes by user, entity and section, and cannot collide across separators", () => {
    const a = draftKey("exam:1", "general", "u1");
    const b = draftKey("exam", "1:general", "u1");
    expect(a).not.toBe(b);
    expect(a).toContain("cms-draft-v1:u1:");
    expect(draftKey("e", "s", null)).toContain(":e:s");
  });

  it("one editor's draft is not offered to another on the same browser", () => {
    saveDraftBackup("exam-1", "general", "faraz's text", { userId: "u1", now });
    expect(loadDraftBackup("exam-1", "general", { userId: "u2", now })).toBeNull();
    expect(loadDraftBackup("exam-1", "general", { userId: "u1", now })?.value).toBe("faraz's text");
  });

  it("never writes anything but the draft value (no token, no session material)", () => {
    saveDraftBackup("exam-1", "general", { notificationUrl: "https://x" }, { userId: "u1", now });
    const raw = store.peek(draftKey("exam-1", "general", "u1")) as string;
    const parsed = JSON.parse(raw) as DraftEnvelope<Record<string, unknown>>;
    expect(Object.keys(parsed).sort()).toEqual(["key", "savedAt", "ttlMs", "value"]);
    expect(raw).not.toMatch(/token|apikey|api_key|authorization|password/i);
  });
});

describe("TTL and corruption — the read is the guard", () => {
  it("a draft inside the TTL loads, one past it does not and is deleted", () => {
    saveDraftBackup("e", "general", "text", { now });
    expect(loadDraftBackup("e", "general", { now })).not.toBeNull();

    const later = () => NOW + DEFAULT_DRAFT_TTL_MS + 1;
    expect(loadDraftBackup("e", "general", { now: later })).toBeNull();
    expect(store.has(draftKey("e", "general", undefined)), "expired entries are swept on read").toBe(false);
  });

  it("honours a custom ttlMs", () => {
    saveDraftBackup("e", "general", "text", { now, ttlMs: 10 });
    expect(loadDraftBackup("e", "general", { now: () => NOW + 5 })).not.toBeNull();
    expect(loadDraftBackup("e", "general", { now: () => NOW + 50 })).toBeNull();
  });

  it("refuses garbage, a mismatched inner key and a future timestamp", () => {
    const key = draftKey("e", "general");
    store.setItem(key, "{not json");
    expect(loadDraftBackup("e", "general", { now })).toBeNull();

    store.setItem(key, JSON.stringify({ key: "some:other:key", savedAt: NOW, ttlMs: 1000, value: "x" }));
    expect(loadDraftBackup("e", "general", { now })).toBeNull();

    store.setItem(key, JSON.stringify({ key, savedAt: NOW + 60_000, ttlMs: 1000, value: "x" }));
    expect(loadDraftBackup("e", "general", { now })).toBeNull();

    store.setItem(key, JSON.stringify(null));
    expect(loadDraftBackup("e", "general", { now })).toBeNull();
  });

  it("isFresh is the single rule both readers use", () => {
    const env: DraftEnvelope = { key: "k", savedAt: NOW, ttlMs: 1000, value: 1 };
    expect(isFresh(env, NOW)).toBe(true);
    expect(isFresh(env, NOW + 1000)).toBe(true);
    expect(isFresh(env, NOW + 1001)).toBe(false);
    expect(isFresh({ ...env, savedAt: NOW + 5 }, NOW)).toBe(false);
    expect(isFresh({ ...env, ttlMs: Number.NaN }, NOW)).toBe(true);   // falls back to the default
  });
});

describe("the restore prompt", () => {
  it("offers the draft only when it is newer than the server's row", () => {
    saveDraftBackup("e", "general", "my text", { now });
    // Server has never saved this section (null) → the draft is the only copy → ask.
    expect(askRestore("e", "general", null, { now })).toEqual({ draft: "my text", savedAt: NOW });
    // The server saved AFTER the draft → the draft is stale → never prompt.
    const env: DraftEnvelope = { key: draftKey("e", "general"), savedAt: NOW, ttlMs: DEFAULT_DRAFT_TTL_MS, value: "my text" };
    store.setItem(env.key, JSON.stringify(env));
    expect(askRestore("e", "general", NOW + 1000, { now })).toBeNull();
    expect(askRestore("e", "general", new Date(NOW + 1000).toISOString(), { now })).toBeNull();
    // Server saved BEFORE the draft → prompt.
    expect(askRestore("e", "general", NOW - 1000, { now })).not.toBeNull();
    expect(askRestore("e", "general", new Date(NOW - 1000).toISOString(), { now })).not.toBeNull();
  });

  it("prompts nothing when there is no draft, and nothing after it is cleared", () => {
    expect(askRestore("e", "general", null, { now })).toBeNull();
    saveDraftBackup("e", "general", "text", { now });
    clearDraftBackup("e", "general", { now });
    expect(askRestore("e", "general", null, { now })).toBeNull();
  });

  it("an unparseable server timestamp is treated as 'no server copy', not as a crash", () => {
    saveDraftBackup("e", "general", "text", { now });
    expect(askRestore("e", "general", "not-a-date", { now })).not.toBeNull();
    expect(askRestore("e", "general", "", { now })).not.toBeNull();
  });
});

describe("listDraftKeys — sweeps while it lists", () => {
  it("returns only live drafts, newest first, and deletes what it skipped", () => {
    saveDraftBackup("e1", "general", "a", { now: () => NOW - 10 });
    saveDraftBackup("e2", "general", "b", { now });
    // A foreign key that must be left alone, and an expired cms-draft entry to be swept.
    store.setItem("unrelated-app-key", "keep me");
    store.setItem(draftKey("e3", "general"), JSON.stringify({ key: draftKey("e3", "general"), savedAt: 1, ttlMs: 10, value: "old" }));

    expect(listDraftKeys({ now })).toEqual([draftKey("e2", "general"), draftKey("e1", "general")]);
    expect(store.peek("unrelated-app-key")).toBe("keep me");
    expect(store.has(draftKey("e3", "general"))).toBe(false);
  });

  it("a corrupt entry in the middle does not stop the sweep or throw", () => {
    saveDraftBackup("e1", "general", "ok", { now });
    store.setItem(draftKey("bad", "general"), "{oops");
    expect(() => listDraftKeys({ now })).not.toThrow();
    expect(listDraftKeys({ now })).toEqual([draftKey("e1", "general")]);
    expect(store.has(draftKey("bad", "general"))).toBe(false);
  });
});
