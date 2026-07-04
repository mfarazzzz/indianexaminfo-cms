/**
 * BlockCard — Renders one ModuleBlock in collapsed / expanded states.
 * Autosave wired via useStableSaveFn + useAutosave (ARCHITECTURE.md §5.3).
 * Zero switch/case on blockType.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Copy, Trash2, Eye, EyeOff, Check, Loader2, AlertCircle } from 'lucide-react'
import { useAutosave } from '@/hooks/useAutosave'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import type { ModuleBlock } from '@/types/entity'
import type { DragHandleProps } from '@/components/shared/DraggableList'
import { cn } from '@/lib/utils'
import { get } from '@/lib/blocks/blockRegistry'

interface BlockCardProps {
  block: ModuleBlock
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: (isVisible: boolean) => void
  onUpdate: (content: Record<string, unknown>) => Promise<ModuleBlock>
  dragHandleProps: DragHandleProps
  isDragging: boolean
}

export function BlockCard({
  block, isExpanded, onExpand, onCollapse,
  onDelete, onDuplicate, onToggleVisibility, onUpdate,
  dragHandleProps, isDragging,
}: BlockCardProps) {
  const [pendingContent, setPendingContent] = useState<Record<string, unknown>>(
    block.content as Record<string, unknown>
  )
  const [isDirty, setIsDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // ── Autosave (ARCHITECTURE.md §5.3) ───────────────────────────────────────
  const saveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    saveFnRef.current = async () => {
      if (isDirty) await onUpdate(pendingContent)
    }
  })
  const stableSaveFn = useCallback(() => saveFnRef.current(), [])
  const { status: autosaveStatus, scheduleAutosave, saveNow } = useAutosave(stableSaveFn, isExpanded)

  useEffect(() => {
    if (autosaveStatus === 'saved') {
      setIsDirty(false)
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 3000)
      return () => clearTimeout(t)
    }
  }, [autosaveStatus])

  const handleContentChange = useCallback((content: Record<string, unknown>) => {
    setPendingContent(content)
    setIsDirty(true)
    scheduleAutosave()
  }, [scheduleAutosave])

  const handleClose = useCallback(async () => {
    if (isDirty) await saveNow()
    setShowPreview(false)
    onCollapse()
  }, [isDirty, saveNow, onCollapse])

  useEffect(() => {
    if (!isExpanded) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isExpanded, handleClose])

  // Save on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (isDirty) saveNow() }, [])

  const def = get(block.blockType)
  const summary = def.summary
    ? def.summary(block.content as Record<string, unknown>)
    : String((block.content as Record<string, unknown>).text ?? block.blockType).slice(0, 60)

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', isDragging && 'opacity-60 shadow-lg')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" aria-label="Drag to reorder block"
          className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </button>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 shrink-0">{block.blockType}</span>
        <p className="flex-1 min-w-0 text-sm text-slate-600 truncate">{summary}</p>
        {/* Autosave indicators */}
        {isExpanded && (
          <div className="flex items-center gap-1 text-xs shrink-0">
            {autosaveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin text-slate-400" /><span className="text-slate-400">Saving…</span></>}
            {showSaved && <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">Saved</span></>}
            {autosaveStatus === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
            {autosaveStatus === 'idle' && isDirty && <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={() => onToggleVisibility(!block.isVisible)}
            aria-label={block.isVisible ? 'Hide block' : 'Show block'}
            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {block.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={isExpanded ? handleClose : onExpand}
            aria-label="Edit block"
            className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Duplicate block"
            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete block"
            className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Expanded: editor */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-3">
          <BlockRenderer
            block={{ ...block, content: pendingContent }}
            mode="edit"
            onContentChange={handleContentChange}
          />
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => saveNow()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Save
            </button>
            <button type="button" onClick={() => setShowPreview(p => !p)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          </div>
          {showPreview && (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <BlockRenderer block={{ ...block, content: pendingContent }} mode="preview" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
