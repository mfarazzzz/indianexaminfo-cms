/**
 * editorDirty.test.ts — the registry's contract, including the two rules that exist to keep a
 * later swap into EditorUIContext honest: it must behave like the reducer it replaces
 * (src/contexts/EditorUIContext.test.tsx pins those cases), and re-marking must not reset the
 * clock or double-count.
 */
import { describe, it, expect } from "vitest";
import { createEditorDirty, hasUnsavedWork } from "./editorDirty";

const clock = () => {
  let t = 1_000;
  return { now: () => t, tick: (ms = 1_000) => { t += ms; } };
};

describe("createEditorDirty — mark / clear / list", () => {
  it("marks and clears one section at a time", () => {
    const r = createEditorDirty();
    r.mark("general");
    r.mark("seo");
    expect(r.isDirty("general")).toBe(true);
    expect(r.isDirty("timeline")).toBe(false);
    expect(r.dirtySections()).toEqual(["general", "seo"]);
    r.clear("general");
    expect(r.isDirty("general")).toBe(false);
    expect(r.dirtySections()).toEqual(["seo"]);
    expect(hasUnsavedWork(r)).toBe(true);
  });

  it("clearAll empties it and clear of an unknown section is a no-op", () => {
    const r = createEditorDirty();
    r.mark("syllabus");
    const before = r.snapshot().seq;
    r.clear("never-marked");
    expect(r.snapshot().seq, "clearing a clean section must not look like a change").toBe(before);
    r.clearAll();
    expect(r.size()).toBe(0);
    expect(hasUnsavedWork(r)).toBe(false);
    const afterFirstClearAll = r.snapshot().seq;
    r.clearAll();      // idempotent
    expect(afterFirstClearAll).toBe(before + 1);
    expect(r.snapshot().seq, "a second clearAll with nothing dirty must not bump the seq").toBe(afterFirstClearAll);
  });

  it("ignores an empty section id (it could never be cleared by name)", () => {
    const r = createEditorDirty();
    r.mark("");
    expect(r.size()).toBe(0);
    expect(r.dirtySections()).toEqual([]);
  });

  it("re-marking keeps the original `since` and refreshes the reason", () => {
    const { now, tick } = clock();
    const r = createEditorDirty({ now });
    r.mark("general", "name");
    const first = r.snapshot().entries[0].since;
    tick();
    r.mark("general", "lastDate");
    expect(r.snapshot().entries).toHaveLength(1);
    expect(r.snapshot().entries[0].since, "since is when it FIRST became dirty").toBe(first);
    expect(r.reasonFor("general")).toBe("lastDate");
    expect(now).toBeTruthy();
  });

  it("the seq answers 'did anything change while the save was in flight?'", async () => {
    const r = createEditorDirty();
    r.mark("general");
    const before = r.snapshot().seq;
    await Promise.resolve();
    expect(r.changedSince(before)).toBe(false);
    r.mark("timeline");
    expect(r.changedSince(before)).toBe(true);
    r.clear("timeline");
    expect(r.changedSince(before), "a clear is a change too — the save may have raced it").toBe(true);
  });

  it("snapshot() is a copy the caller cannot mutate through", () => {
    const r = createEditorDirty();
    r.mark("seo");
    const snap = r.snapshot();
    snap.entries[0].section = "hacked";
    snap.entries.push({ section: "extra", reason: "", since: 0 });
    expect(r.dirtySections()).toEqual(["seo"]);
    expect(r.snapshot().entries[0].section).toBe("seo");
  });

  it("behaves like the EditorUIContext reducer it is meant to replace", () => {
    // The three cases src/contexts/EditorUIContext.test.tsx pins: mark two, clear one only,
    // then clear everything.
    const r = createEditorDirty();
    r.mark("general");
    r.mark("timeline");
    r.clear("general");
    expect(r.dirtySections()).toEqual(["timeline"]);
    r.mark("seo");
    r.clearAll();
    expect(r.dirtySections()).toEqual([]);
  });
});
