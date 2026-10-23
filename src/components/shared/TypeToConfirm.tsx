/**
 * TypeToConfirm — a destructive-action dialog that requires the operator to TYPE a
 * phrase before the button unlocks (reference-page review 23 Oct, P2 item 16).
 *
 * Why not the shared ConfirmDialog: it asks "are you sure?", which one tired click
 * answers. Deleting an exam removes every edition, every module and every update in
 * one call, and the record may be one the editor did not mean to pick. Requiring the
 * record's own name — typed, not clicked — moves the confirmation from reflex to
 * reading. The typed value is compared after trimming; it is never stored or sent.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in the operator's language. Rendered as written. */
  description: string;
  /** The exact text the operator must type to unlock the action. */
  requireText: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export function TypeToConfirm({ open, onOpenChange, title, description, requireText, confirmLabel, onConfirm }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Every reopen starts empty: a stale match from a previous record must not
  // leave the button armed.
  useEffect(() => {
    if (open) {
      setValue("");
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;
  const armed = value.trim() === requireText.trim() && requireText.trim().length > 0;

  const submit = async () => {
    if (!armed || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <label className="mt-4 block text-xs font-medium text-slate-600">
          Type <span className="font-mono font-semibold text-slate-900">{requireText}</span> to confirm
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            placeholder={requireText}
            autoComplete="off"
            spellCheck={false}
            data-testid="type-to-confirm-input"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!armed || busy}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="type-to-confirm-submit"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
        {!armed && (
          <p className="mt-2 text-[11px] text-slate-400" data-testid="type-to-confirm-hint">
            The button unlocks when the text matches exactly.
          </p>
        )}
      </div>
    </div>
  );
}
