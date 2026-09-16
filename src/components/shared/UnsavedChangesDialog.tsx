/**
 * UnsavedChangesDialog — three-choice guard shown when the editor is about to
 * lose unsaved changes (tab switch or in-app navigation).
 *
 * Buttons, in the order the user reasons about them:
 *   - Save & continue  → run the pending save, then proceed
 *   - Discard changes  → proceed WITHOUT saving (the explicit "throw it away")
 *   - Cancel           → stay exactly where you are, nothing lost
 *
 * The message always names WHERE the unsaved changes are (e.g. "Modules") so the
 * editor knows what they'd lose. This dialog never writes anything itself — it
 * only reports the user's choice back to the caller, which owns the save.
 */
import { AlertTriangle, Loader2 } from 'lucide-react'

export interface UnsavedChangesDialogProps {
  /** Human label of the surface with unsaved changes, e.g. "Modules", "Identity". */
  where: string
  /** True while a "Save & continue" is in flight (disables buttons, shows spinner). */
  saving?: boolean
  onSaveAndContinue: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  where,
  saving = false,
  onSaveAndContinue,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 p-5">
          <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 id="unsaved-title" className="text-base font-semibold text-slate-900">
              Unsaved changes
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              You have unsaved changes in <strong>{where}</strong>. What would you like to do?
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save &amp; continue
          </button>
        </div>
      </div>
    </div>
  )
}
