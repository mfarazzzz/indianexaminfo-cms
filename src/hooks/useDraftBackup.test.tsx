/**
 * useDraftBackup.test.tsx — the wiring (owner batch 5, Phase T), not the storage module
 * (src/lib/editing/draftBackup.test.ts covers that). What is tested here is TIMING and CHOICE:
 *
 *  • a clean section writes nothing, and a dirty one costs ONE write per quiet window rather
 *    than one per keystroke — and the window keeps re-arming, so text typed long after the first
 *    write is still backed up (the bug the third test in the first block pins down);
 *  • the tab being hidden writes straight away, because that is the moment an unsaved edit is
 *    genuinely lost;
 *  • an offer appears only for a draft that is newer than the server's own row and still inside
 *    its TTL, for THIS user and THIS section — and it stays until the editor answers it,
 *    because restoring must never be automatic and Discard must never be assumed;
 *  • a Restore keeps the copy (the text has not reached the database yet); markSaved after a
 *    real save retires it; Discard drops it immediately;
 *  • a hostile localStorage (denied, quota, garbage) degrades to "no backup" and never throws.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftBackup, type UseDraftBackupOptions } from "./useDraftBackup";
import { draftKey, saveDraftBackup, loadDraftBackup } from "@/lib/editing/draftBackup";

const NOW = 1_700_000_000_000;
/** THE LIVE FAKE CLOCK. `vi.advanceTimersByTime()` moves `Date.now()` along with the timers, so a
 *  draft written when the debounce fires is stamped NOW+1200 — reading it with a frozen NOW would
 *  make isFresh() reject it as clock skew ("savedAt > now") and silently delete it. Reads here use
 *  the same clock the write used, exactly as the browser does. */
const live = () => Date.now();
/** What the tests pass as "the server's own timestamp" — an hour before `now`. */
const SERVER_SAVED_AT = new Date(NOW - 3_600_000).toISOString();
/** A draft written a minute ago. It must be newer than SERVER_SAVED_AT and must NOT be in the
 *  future: draftBackup.isFresh() rejects any savedAt ahead of the clock, so a future timestamp
 *  silently means "there is no draft at all". */
const DRAFT_SAVED_AT = NOW - 60_000;
/** Reads must use the SAME user scope the hook writes under — the key is
 *  `cms-draft-v1:<user>:<entity>:<section>`, so omitting userId looks up a different entry. */
const READER = { userId: "u1", now: live };

/** An inspectable localStorage with the API the browser gives. */
class Mem {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

let store: Mem;

beforeEach(() => {
  store = new Mem();
  // In jsdom `globalThis === window`, so stubbing `localStorage` is what `storageFor()` reads
  // (verified: `window.localStorage === stub` is true). No need to stub `window` itself.
  vi.stubGlobal("localStorage", store);
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Opts = UseDraftBackupOptions<string>;

const setup = (over: Partial<Opts> = {}) =>
  renderHook((props: Opts) => useDraftBackup<string>(props), {
    initialProps: {
      entityId: "exam-1", section: "general", values: "", dirty: false,
      serverSavedAt: SERVER_SAVED_AT, userId: "u1", ...over,
    } as Opts,
  });

/** Let the debounce elapse so any queued write lands. */
const settle = () => act(() => { vi.advanceTimersByTime(2_000); });

describe("writing — debounced, and only while dirty", () => {
  it("a section with no unsaved edits writes nothing", () => {
    const { result } = setup({ dirty: false, values: "typed then saved elsewhere" });
    settle();
    expect(store.length).toBe(0);
    expect(result.current.restore).toBeNull();
  });

  it("one pause costs one write, and it holds the LATEST values", () => {
    const { rerender } = setup({ dirty: true, values: "The exam's " });
    act(() => { vi.advanceTimersByTime(400); });
    expect(store.length, "no write while the editor is still typing").toBe(0);

    rerender({ entityId: "exam-1", section: "general", values: "The exam's last date is 3 Nov", dirty: true, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
    act(() => { vi.advanceTimersByTime(400); });
    rerender({ entityId: "exam-1", section: "general", values: "The exam's last date is 3 Nov 2026", dirty: true, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
    settle();

    expect(store.length).toBe(1);
    expect(loadDraftBackup<string>("exam-1", "general", READER)?.value).toBe("The exam's last date is 3 Nov 2026");
  });

  it("keeps backing up text typed AFTER the first write (one copy, always the newest)", () => {
    // The defect this test exists for: a single-shot debounce armed on the dirty transition would
    // freeze the backup at whatever was on screen 1.2s into the session, and an editor who typed
    // for another ten minutes would lose all of it.
    const { rerender } = setup({ dirty: true, values: "first half" });
    settle();
    expect(loadDraftBackup<string>("exam-1", "general", READER)?.value).toBe("first half");

    rerender({ entityId: "exam-1", section: "general", values: "first half plus ten more minutes of typing", dirty: true, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
    settle();

    expect(loadDraftBackup<string>("exam-1", "general", READER)?.value)
      .toBe("first half plus ten more minutes of typing");
    expect(store.length, "the same key, rewritten — not one entry per quiet window").toBe(1);
  });

  it("a quiet window that found nothing changed costs no write", () => {
    const { rerender } = setup({ dirty: true, values: "unchanged text" });
    settle();
    settle();
    settle();
    expect(store.length).toBe(1);
    rerender({ entityId: "exam-1", section: "general", values: "still unchanged", dirty: true, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
    settle();
    expect(store.length, "one new value, one new write").toBe(1);
    expect(loadDraftBackup<string>("exam-1", "general", READER)?.value).toBe("still unchanged");
  });

  it("the tab going hidden writes immediately — that is the moment edits are actually lost", () => {
    const { rerender } = setup({ dirty: true, values: "typed then minimised" });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      act(() => { document.dispatchEvent(new Event("visibilitychange")); });
      expect(loadDraftBackup<string>("exam-1", "general", READER)?.value).toBe("typed then minimised");
      // and no debounce had to elapse
      expect(store.length).toBe(1);
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
    rerender({ entityId: "exam-1", section: "general", values: "x", dirty: false, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
  });

  it("a hostile localStorage is not the editor's problem", () => {
    vi.stubGlobal("localStorage", {
      get length(): number { throw new Error("denied"); },
      key(): string | null { throw new Error("denied"); },
      getItem(): string | null { throw new Error("denied"); },
      setItem(): void { throw new Error("QuotaExceededError"); },
      removeItem(): void { throw new Error("denied"); },
    });
    expect(() => setup({ dirty: true, values: "text" })).not.toThrow();
    settle();
  });
});

describe("the offer — only when it is genuinely worth asking", () => {
  const aNewerDraft = () =>
    saveDraftBackup("exam-1", "general", "unsaved prose", { userId: "u1", now: () => DRAFT_SAVED_AT });

  it("appears for a newer draft, and stays until the editor answers it", () => {
    aNewerDraft();
    const { result } = setup();
    expect(result.current.restore).toEqual({ draft: "unsaved prose", savedAt: DRAFT_SAVED_AT });

    // A savedAt ahead of the clock is refused as skew, not offered: prove the fixture is on the
    // right side of that rule rather than relying on it.
    expect(DRAFT_SAVED_AT).toBeLessThan(NOW);
    expect(DRAFT_SAVED_AT).toBeGreaterThan(Date.parse(SERVER_SAVED_AT));

    // neither action on its own is taken: no auto-restore, no auto-discard
    settle();
    expect(result.current.restore).not.toBeNull();
  });

  it("is silent for a draft older than the server's row — somebody else has saved since", () => {
    saveDraftBackup("exam-1", "general", "stale prose", { userId: "u1", now: () => NOW - 7_200_000 });
    const { result } = setup();
    expect(result.current.restore).toBeNull();
  });

  it("is silent once the copy has expired", () => {
    saveDraftBackup("exam-1", "general", "ancient", { userId: "u1", ttlMs: 1, now: () => NOW - 10_000 });
    const { result } = setup();
    expect(result.current.restore).toBeNull();
  });

  it("never offers another user's draft, nor another section's", () => {
    saveDraftBackup("exam-1", "general", "someone else's text", { userId: "u2", now: () => DRAFT_SAVED_AT });
    saveDraftBackup("exam-1", "syllabus", "other section", { userId: "u1", now: () => DRAFT_SAVED_AT });
    const { result } = setup();
    expect(result.current.restore).toBeNull();
    // …and both are still in storage, untouched, under their own keys
    expect(store.key(0)).toBeTruthy();
    expect(loadDraftBackup("exam-1", "syllabus", READER)?.value).toBe("other section");
    expect(loadDraftBackup("exam-1", "general", { userId: "u2", now: live })).not.toBeNull();
  });

  it("Restore keeps the copy; Discard drops it; a successful save drops it", () => {
    aNewerDraft();
    const { result } = setup();
    act(() => result.current.acceptRestore());
    expect(result.current.restore).toBeNull();
    expect(loadDraftBackup("exam-1", "general", READER)?.value, "restored text is not in the database yet").toBe("unsaved prose");

    aNewerDraft();
    const second = setup();
    expect(second.result.current.restore).not.toBeNull();
    act(() => second.result.current.dismissRestore());
    expect(second.result.current.restore).toBeNull();
    expect(loadDraftBackup("exam-1", "general", READER)).toBeNull();

    aNewerDraft();
    const third = setup();
    act(() => third.result.current.markSaved());
    expect(loadDraftBackup("exam-1", "general", READER)).toBeNull();
    third.unmount();
    second.unmount();
  });

  it("stops offering as soon as the editor starts typing again", () => {
    aNewerDraft();
    const { result, rerender } = setup({ dirty: false });
    expect(result.current.restore).not.toBeNull();
    rerender({ entityId: "exam-1", section: "general", values: "fresh edit", dirty: true, serverSavedAt: SERVER_SAVED_AT, userId: "u1" });
    settle();
    // the offer is gone (the section is dirty, so its own draft now IS the live text)…
    expect(result.current.restore).toBeNull();
    // …and what is in storage is the new text, under the same key.
    expect(loadDraftBackup("exam-1", "general", READER)?.value).toBe("fresh edit");
    expect(store.length).toBe(1);
    expect(draftKey("exam-1", "general", "u1")).toContain("exam-1");
  });
});
