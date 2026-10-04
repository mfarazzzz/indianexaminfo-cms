/**
 * useColumnAutosave — Debounced autosave for column-backed fields (R1.5).
 *
 * Same contract as useModuleAutosave (2s debounce, 3 retries, status/pending
 * tracking, flush on unmount) but calls a provided async save function instead
 * of saveModuleContent. Used by EligibilityCard, ApplicationFeeCard, etc.
 * which write to exam_editions / exams columns rather than content_modules.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/types/modules";

interface UseColumnAutosaveReturn {
  scheduleAutosave: (data: Record<string, unknown>) => void;
  status: SaveStatus;
  pending: boolean;
}

const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export function useColumnAutosave(
  saveFn: (data: Record<string, unknown>) => Promise<void>,
): UseColumnAutosaveReturn {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Record<string, unknown> | null>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const doSave = useCallback(async (data: Record<string, unknown>) => {
    setStatus("saving");
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await saveFnRef.current(data);
        setStatus("saved");
        setPending(false);
        return;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          console.error(`[useColumnAutosave] Failed after ${MAX_RETRIES} retries:`, err);
          setStatus("error");
          return;
        }
        await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt - 1)));
      }
    }
  }, []);

  const scheduleAutosave = useCallback((data: Record<string, unknown>) => {
    latestRef.current = data;
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (latestRef.current) doSave(latestRef.current);
    }, DEBOUNCE_MS);
  }, [doSave]);

  // Flush on unmount
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (latestRef.current) void doSave(latestRef.current);
    }
  };
  useEffect(() => () => flushRef.current(), []);

  return { scheduleAutosave, status, pending };
}
