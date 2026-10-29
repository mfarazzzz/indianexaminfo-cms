/**
 * useDraftBackup — the live-editor wiring of src/lib/editing/draftBackup.ts
 * (owner batch 5, Phase T: "adopt ONLY the browser draft backup in the live editor").
 *
 * WHAT IT IS FOR. The entity editor's autosave waits 30 seconds of quiet before it writes
 * (src/hooks/useAutosave.ts, DEBOUNCE_MS = 30_000), and the General form additionally holds
 * edits until Save. A closed tab, a crash or a lost network inside that window loses the text —
 * the database has it no other way. This hook keeps a second copy in the BROWSER and offers to
 * put it back the next time the same section of the same record is opened.
 *
 * WHAT IT IS NOT. It is not a save path and not a second source of truth: nothing here reads
 * from or writes to Supabase, nothing is sent anywhere, and no timing or content of a database
 * write changes. If the prompt is dismissed the draft is simply forgotten when it ages out.
 *
 * The rules the caller can rely on, enforced by the module this wraps:
 *  • it never throws — localStorage may be absent, denied, full, or holding garbage, and every
 *    one of those degrades to "no backup" rather than a broken editor;
 *  • the copy follows the editor: it is written once per quiet window while the section is
 *    unsaved (not once per keystroke, and NOT once per editing session — text typed minutes
 *    later is still protected), plus one final write the instant the tab becomes hidden;
 *  • the prompt only appears for a draft NEWER than the server's own timestamp, so an old
 *    leftover can never overwrite work someone else saved;
 *  • restoring is a choice, never automatic: `restore` is offered and stays offered until the
 *    editor answers it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  askRestore, clearDraftBackup, saveDraftBackup, type DraftEnvelope,
} from "@/lib/editing/draftBackup";

/** Typing pauses shorter than this do not each cost a localStorage write. */
const WRITE_DEBOUNCE_MS = 1200;

/**
 * A signature for "is this the text I already wrote?" — so the periodic write stays quiet when
 * nothing changed. A value that cannot be serialised cannot be backed up either (saveDraftBackup
 * would fail on it for the same reason), so it gets a sentinel that simply means "do not retry").
 */
function signature(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "\u0000unserialisable";
  }
}

export interface UseDraftBackupOptions<T> {
  /** The record id. A new, unsaved record passes null and is keyed under "new". */
  entityId: string | null;
  /** The section this instance protects — 'general', a module id, … (the backup is per section). */
  section: string;
  /** The current form values. Only read when something is actually dirty. */
  values: T;
  /** Whether the section currently has unsaved edits. */
  dirty: boolean;
  /** The server's own last-saved timestamp for this section, when the caller knows it. */
  serverSavedAt?: string | number | null;
  /** The signed-in user id, so a shared browser does not offer one editor another's draft. */
  userId?: string | null;
}

export interface UseDraftBackupResult<T> {
  /** Non-null while an un-answered offer is on screen; `draft` is what to put back. */
  restore: { draft: T; savedAt: number } | null;
  /** "Restore": hides the offer. The copy stays in storage until markSaved(), so an editor who
   *  restores, keeps typing and then closes the tab is still covered. */
  acceptRestore: () => void;
  /** "Discard": hides the offer AND drops the copy now, rather than at TTL. */
  dismissRestore: () => void;
  /** Call after a SUCCESSFUL save of this section — the server has it, so the copy is spent. */
  markSaved: () => void;
}

export function useDraftBackup<T>(opts: UseDraftBackupOptions<T>): UseDraftBackupResult<T> {
  const { entityId, section, values, dirty, serverSavedAt, userId } = opts;
  const key = entityId || "new";
  const [restore, setRestore] = useState<{ draft: T; savedAt: number } | null>(null);

  // `values` changes on every keystroke; the timers below must not re-arm off a fresh function
  // reference each render, so the pending values are read through a ref and the write itself
  // lives in a stable callback.
  const latest = useRef(values);
  latest.current = values;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Signature of the text currently in storage — stops the periodic write rewriting a copy
   *  that has not changed. */
  const written = useRef<string | null>(null);

  // ── offer, once per mount, what (if anything) is waiting in this browser ──
  useEffect(() => {
    const pending = askRestore<T>(key, section, serverSavedAt ?? null, { userId });
    if (pending) setRestore(pending);
    // Deliberately on mount only: re-running it on every serverSavedAt change would re-open a
    // prompt the editor has already answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, section]);

  // ── write, one per WRITE_DEBOUNCE_MS while the section is dirty ─────────────
  // Deliberately a REPEATING quiet-window, not a single shot: an editor who types for ten minutes
  // must not end up with a backup of the first sentence. Each write re-arms the window, and a
  // window that finds the text unchanged costs nothing (see `written`).
  const flush = useCallback((): boolean => {
    const next = latest.current;
    const sig = signature(next);
    if (sig === written.current) return true;
    if (sig === "\u0000unserialisable") return false;   // cannot be backed up, cannot be retried
    // saveDraftBackup swallows every failure and returns false; a false here means "no extra
    // safety net this time", never "your save failed".
    const ok = saveDraftBackup(key, section, next, { userId });
    if (ok) written.current = sig;
    return ok;
  }, [key, section, userId]);

  useEffect(() => {
    if (!dirty) return;
    let cancelled = false;
    const arm = () => {
      timer.current = setTimeout(() => {
        if (cancelled) return;
        timer.current = null;
        flush();
        arm();                        // keep protecting the text typed after this write
      }, WRITE_DEBOUNCE_MS);
    };
    arm();
    return () => {
      cancelled = true;
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [dirty, flush]);

  // The moment that actually loses an edit is the tab being closed, minimised to a dying laptop
  // or a crash — all of which fire `visibilitychange: hidden` and none of which wait for a
  // debounce. One synchronous localStorage write there is the whole point of the backup.
  useEffect(() => {
    if (!dirty || typeof document === "undefined") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [dirty, flush]);

  // Once the editor is typing again, the offer is withdrawn: applying an older copy on top of
  // fresh keystrokes would silently discard what is on screen right now. (The stored copy is
  // overwritten by the debounced write below, so the newer text is what survives.)
  useEffect(() => { if (dirty) setRestore(null); }, [dirty]);

  const acceptRestore = useCallback(() => {
    // Only the banner goes away. clearDraftBackup() would be wrong here: the restored text has
    // not reached the database yet, and markSaved() is what retires the copy.
    setRestore(null);
  }, []);

  const dismissRestore = useCallback(() => {
    setRestore(null);
    clearDraftBackup(key, section, { userId });
    written.current = null;      // storage is empty for this section again
  }, [key, section, userId]);

  const markSaved = useCallback(() => {
    setRestore(null);
    clearDraftBackup(key, section, { userId });
    // The text on screen IS what the server now holds, so a quiet window that is still in flight
    // must not re-create the copy we just retired — remembering its signature makes that flush a
    // no-op, and the NEXT edit changes the signature and writes again.
    written.current = signature(latest.current);
  }, [key, section, userId]);

  return { restore, acceptRestore, dismissRestore, markSaved };
}

/** Type helper for the callers that want to name the stored shape. */
export type StoredDraft<T> = DraftEnvelope<T>;
