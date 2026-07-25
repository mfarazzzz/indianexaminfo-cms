/**
 * useSaveAll — Orchestrates saving all dirty tabs via Promise.allSettled.
 * Tracks per-tab success/failure, clears dirty flags only for succeeded tabs. (Req 11)
 */
import { useState, useCallback } from 'react'
import { useEditorUI } from '@/contexts/EditorUIContext'

export interface SaveAllResult {
  succeeded: string[]
  failed: Array<{ tab: string; error: string }>
}

type SaveTabFn = (tabKey: string) => Promise<void>

export function useSaveAll(saveTabFn: SaveTabFn) {
  const { state, clearDirty } = useEditorUI()
  const [isSaving, setIsSaving] = useState(false)
  const [lastResult, setLastResult] = useState<SaveAllResult | null>(null)

  const saveAll = useCallback(async (): Promise<SaveAllResult> => {
    const dirtyTabs = Array.from(state.dirtyTabs)
    if (dirtyTabs.length === 0) {
      const result = { succeeded: [], failed: [] }
      setLastResult(result)
      return result
    }

    setIsSaving(true)
    setLastResult(null)

    const results = await Promise.allSettled(
      dirtyTabs.map(async (tab) => {
        await saveTabFn(tab)
        return tab
      })
    )

    const succeeded: string[] = []
    const failed: Array<{ tab: string; error: string }> = []

    results.forEach((result, idx) => {
      const tab = dirtyTabs[idx]
      if (result.status === 'fulfilled') {
        succeeded.push(tab)
        clearDirty(tab)
      } else {
        failed.push({
          tab,
          error: result.reason?.message ?? 'Unknown error',
        })
      }
    })

    const finalResult = { succeeded, failed }
    setLastResult(finalResult)
    setIsSaving(false)
    return finalResult
  }, [state.dirtyTabs, saveTabFn, clearDirty])

  return {
    saveAll,
    isSaving,
    lastResult,
    hasDirtyTabs: state.dirtyTabs.size > 0,
  }
}
