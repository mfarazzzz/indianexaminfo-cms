/**
 * editorDirty.ts — the per-section dirty registry (owner batch 4, CMS R2.5 increment 1 of 3).
 *
 * WHY THIS EXISTS. The editor's "unsaved changes" state is a `Set<string>` of tab ids inside
 * EditorUIContext, and every consumer reaches for it directly — GeneralTab marks `'general'`,
 * the rail asks `sectionIsDirty(tabId, flags)`, useSaveAll iterates `state.dirtyTabs`. That is
 * fine while there is one set and one writer. What R2.5 needs (a save-conflict prompt, and a
 * browser draft backup that knows what it is protecting) is a registry that can answer, for ONE
 * section, "is it dirty, and what was the last thing that made it dirty?" — without every
 * component re-inventing the bookkeeping and drifting from the others.
 *
 * THIS FILE IS INERT BY DESIGN. Nothing imports it yet. The owner's batch-4 rule for R2.5 is
 * exactly three zero-risk increments with NO behaviour change, so the registry ships here,
 * tested, and gets adopted by EditorUIContext when R2.5 is approved. The semantics match the
 * existing reducer one-for-one (mark / clear / clearAll / has / list), which is what makes the
 * later swap a rename rather than a re-design; src/contexts/EditorUIContext.test.tsx pins the
 * behaviour being matched.
 *
 * What it adds over a bare Set:
 *  • a reason per section (which control/field marked it) — a conflict prompt has to say what
 *    is at risk, not just that something is;
 *  • a monotonic sequence, so "did anything change while the save was in flight?" is a
 *    comparison rather than a guess;
 *  • an immutable snapshot, so a save loop can iterate a list that cannot mutate underneath it.
 */

export type DirtyReason = string;

export interface DirtyEntry {
  /** The section/tab id — the same string EditorUIContext uses today ('general', 'seo', …). */
  section: string;
  /** Why it is dirty: a field name, a control, or '' when the caller has nothing better. */
  reason: DirtyReason;
  /** Set when the section was first marked in this registry's lifetime. */
  since: number;
}

export interface DirtySnapshot {
  /** Monotonic counter: every mark/clear of a NEW section bumps it. */
  seq: number;
  entries: DirtyEntry[];
}

export interface EditorDirtyRegistry {
  mark(section: string, reason?: DirtyReason): void;
  clear(section: string): void;
  clearAll(): void;
  isDirty(section: string): boolean;
  dirtySections(): string[];
  reasonFor(section: string): DirtyReason | undefined;
  snapshot(): DirtySnapshot;
  /** True when anything happened since `seq` — the "did it change during the save?" test. */
  changedSince(seq: number): boolean;
  size(): number;
}

/**
 * createEditorDirty — a plain object + Map, no React, no globals.
 *
 * `now` is injectable because the TTL/`since` behaviour has to be tested without waiting, and
 * because a registry that reads Date.now() at import time cannot be tested deterministically at
 * all. Only mark() takes a timestamp: clearing a section is not an event worth stamping.
 */
export function createEditorDirty(opts: { now?: () => number } = {}): EditorDirtyRegistry {
  const now = opts.now ?? (() => Date.now());
  const entries = new Map<string, DirtyEntry>();
  let seq = 0;

  return {
    mark(section: string, reason: DirtyReason = "") {
      if (!section) return;                      // an empty id can never be cleared by name
      if (entries.has(section)) {
        // Re-marking the same section is normal (the user keeps typing): keep `since` from the
        // first mark so the rail can show how long it has been dirty, and refresh the reason.
        const existing = entries.get(section)!;
        if (existing.reason !== reason) entries.set(section, { ...existing, reason });
        return;
      }
      entries.set(section, { section, reason, since: now() });
      seq += 1;
    },

    clear(section: string) {
      if (!entries.has(section)) return;         // clearing a clean section changes nothing
      entries.delete(section);
      seq += 1;
    },

    clearAll() {
      if (entries.size === 0) return;
      entries.clear();
      seq += 1;
    },

    isDirty: (section) => entries.has(section),

    // Sorted so two callers asking the same question get the same list in the same order —
    // useSaveAll iterates this, and an ordering that changes between renders is its own bug.
    dirtySections: () => [...entries.keys()].sort(),

    reasonFor: (section) => entries.get(section)?.reason,

    snapshot(): DirtySnapshot {
      return { seq, entries: [...entries.values()].map((e) => ({ ...e })) };
    },

    changedSince: (since) => since !== seq,

    size: () => entries.size,
  };
}

/**
 * Guard for the "unsaved work" prompt: a section is only worth interrupting a reader for when
 * it is actually dirty. Kept separate so a component never writes `dirty.size > 0` inline and
 * forgets the empty-string case (which mark() deliberately ignores).
 */
export function hasUnsavedWork(registry: EditorDirtyRegistry): boolean {
  return registry.size() > 0;
}
