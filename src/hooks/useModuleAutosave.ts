/**
 * useModuleAutosave — Debounced autosave hook for module content.
 *
 * - 2-second debounce on content changes
 * - Retries up to 3 times with exponential backoff on failure
 * - Injects _meta (updatedAt, updatedBy) before saving
 * - Tracks status: idle, saving, saved, error
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { saveModuleContent } from "@/services/moduleContentService";
import { useAuth } from "@/hooks/useAuth";
import type { SaveStatus } from "@/types/modules";

interface UseModuleAutosaveReturn {
  /** Trigger an immediate save (skips debounce) */
  save: (content: Record<string, unknown>) => Promise<void>;
  /** Schedule a debounced autosave */
  scheduleAutosave: (content: Record<string, unknown>) => void;
  /** Current save status */
  status: SaveStatus;
  /**
   * True from the moment a change is scheduled until it has been persisted.
   * Covers BOTH the 2s debounce window AND the in-flight network save — the
   * whole interval during which leaving the tab would drop an unsaved edit.
   * The unsaved-changes guard reads this so a fast tab-switch can't silently
   * discard a module edit that hasn't autosaved yet.
   */
  pending: boolean;
  /** Timestamp of last successful save */
  lastSavedAt: string | null;
}

const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export function useModuleAutosave(
  editionId: string | null,
  moduleSlug: string
): UseModuleAutosaveReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<SaveStatus>("idle");
  // `pending` is TRUE across the whole unsaved window: from scheduleAutosave()
  // (start of the 2s debounce) through the network save, until it lands. The
  // guard treats a pending module as dirty so leaving mid-debounce is caught.
  const [pending, setPending] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<Record<string, unknown> | null>(null);

  const doSave = useCallback(async (content: Record<string, unknown>) => {
    if (!editionId || !moduleSlug) return;

    setStatus("saving");
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        await saveModuleContent(editionId, moduleSlug, content, user?.id ?? "system");
        setStatus("saved");
        setLastSavedAt(new Date().toISOString());
        setPending(false); // change is persisted — no longer dirty
        return;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          console.error(`[useModuleAutosave] Failed after ${MAX_RETRIES} retries:`, err);
          setStatus("error");
          // Leave `pending` TRUE on terminal failure: the edit is still unsaved,
          // so the guard should still protect it until a successful save.
          return;
        }
        // Exponential backoff: 1s, 2s, 4s
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, [editionId, moduleSlug, user?.id]);

  const save = useCallback(async (content: Record<string, unknown>) => {
    // Cancel any pending debounced save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave(content);
  }, [doSave]);

  const scheduleAutosave = useCallback((content: Record<string, unknown>) => {
    latestContentRef.current = content;
    setPending(true); // dirty from the first keystroke of the debounce window

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule new debounced save
    timerRef.current = setTimeout(() => {
      if (latestContentRef.current) {
        doSave(latestContentRef.current);
      }
    }, DEBOUNCE_MS);
  }, [doSave]);

  // ── Flush on unmount ───────────────────────────────────────────────────────
  // If a debounced save is still waiting when this hook unmounts (card collapses
  // via remount, tab switch, editor closes), fire it NOW instead of letting the
  // timer die with the component and dropping the edit silently.
  //
  // A React cleanup is synchronous and doSave() is async, so we cannot AWAIT the
  // write here. What we CAN do reliably is INITIATE it: for an in-app unmount the
  // browser does not abort an in-flight fetch just because a component unmounted,
  // so the POST completes detached (its setState calls are no-ops, which is fine).
  // The one case this does NOT cover is a full page unload / hard navigation, where
  // the browser may cut off the in-flight request — a synchronous cleanup cannot
  // guarantee an async POST there. That needs a separate beforeunload/keepalive
  // mechanism and is out of scope for a debounce flush; flagged in the report.
  //
  // We keep the flush logic in a ref so the unmount-only effect (deps []) always
  // runs the latest closure without re-subscribing on every render.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (latestContentRef.current) {
        // Fire-and-forget: initiate the pending save on the way out.
        void doSave(latestContentRef.current);
      }
    }
  };

  useEffect(() => {
    return () => flushRef.current();
  }, []);

  return { save, scheduleAutosave, status, pending, lastSavedAt };
}
