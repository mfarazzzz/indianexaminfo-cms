/**
 * SaveAllButton — Sticky "Save All Changes" button.
 * Visible only when dirty tabs exist. Shows loading/error state per tab. (Req 11)
 */
import React, { useCallback } from 'react'
import { Save, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSaveAll } from '@/hooks/useSaveAll'

interface SaveAllButtonProps {
  entityId: string
  /** Function to save a specific tab by its key */
  onSaveTab: (tabKey: string) => Promise<void>
}

export function SaveAllButton({ entityId, onSaveTab }: SaveAllButtonProps) {
  const { saveAll, isSaving, lastResult, hasDirtyTabs } = useSaveAll(onSaveTab)

  const handleClick = useCallback(async () => {
    const result = await saveAll()
    if (result.failed.length === 0 && result.succeeded.length > 0) {
      toast.success(`Saved ${result.succeeded.length} tab${result.succeeded.length > 1 ? 's' : ''}`)
    } else if (result.failed.length > 0) {
      toast.error(`${result.failed.length} tab${result.failed.length > 1 ? 's' : ''} failed to save`)
    }
  }, [saveAll])

  if (!hasDirtyTabs && !lastResult?.failed.length) return null

  return (
    <div className="sticky bottom-4 z-40 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {/* Error messages for failed tabs */}
        {lastResult?.failed && lastResult.failed.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 max-w-sm">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed tabs:
            </div>
            <ul className="space-y-0.5 ml-5">
              {lastResult.failed.map(f => (
                <li key={f.tab}>{f.tab}: {f.error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Save button */}
        {hasDirtyTabs && (
          <button
            type="button"
            onClick={handleClick}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:opacity-60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Saving…' : 'Save All Changes'}
          </button>
        )}
      </div>
    </div>
  )
}
