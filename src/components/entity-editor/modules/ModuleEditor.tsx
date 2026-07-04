/**
 * ModuleEditor — Inline module editor.
 * Metadata form + block list + Add Block + Preview + Publish actions.
 * Zero switch/case on moduleType. No db import.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Eye, Send, Loader2, Check, AlertCircle } from 'lucide-react'
import { ModuleCreateSchema, type ModuleCreateInput } from '@/lib/validation/entitySchemas'
import { useModuleEditor } from '@/hooks/useModuleEditor'
import { useAutosave } from '@/hooks/useAutosave'
import { updateModule } from '@/services/entity/moduleService'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FieldGroup, inputCls, SectionHeader } from '@/components/shared/form/FormField'
import { AddBlockMenu } from '@/components/blocks/AddBlockMenu'
import { BlockList } from './BlockList'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { useAuth } from '@/hooks/useAuth'

interface ModuleEditorProps {
  moduleId: string
  onRequestClose: () => void
  onPublish: (moduleId: string, userId: string) => Promise<void>
}

export function ModuleEditor({ moduleId, onRequestClose, onPublish }: ModuleEditorProps) {
  const { user } = useAuth()
  const {
    blocks, isLoading, createBlock, updateBlock, deleteBlock,
    duplicateBlock, reorderBlocks, toggleBlockVisibility,
    expandedId, setExpandedId, pendingDeleteId, confirmDelete, cancelDelete,
  } = useModuleEditor(moduleId)

  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const { register, handleSubmit, formState: { isDirty, errors } } = useForm<ModuleCreateInput>({
    resolver: zodResolver(ModuleCreateSchema),
    defaultValues: { moduleType: '', workflowStatus: 'draft', isFeatured: false, tags: [], displayOrder: 0 },
  })

  // Autosave — stable ref pattern (ARCHITECTURE.md §5.3)
  const saveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    saveFnRef.current = handleSubmit(async (data) => { await updateModule(moduleId, data) })
  })
  const stableSaveFn = useCallback(() => saveFnRef.current(), [])
  const { status: autosaveStatus, scheduleAutosave, saveNow } = useAutosave(stableSaveFn, true)

  const handleClose = useCallback(async () => {
    if (isDirty) await saveNow()
    onRequestClose()
  }, [isDirty, saveNow, onRequestClose])

  const handlePublish = async () => {
    if (!user?.id) return
    setIsPublishing(true)
    try { await onPublish(moduleId, user.id) } finally { setIsPublishing(false) }
  }

  return (
    <div className="p-4 space-y-5">
      {/* Autosave status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {autosaveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
          {autosaveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500" /> Saved</>}
          {autosaveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-red-500" /> Autosave failed</>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview(p => !p)}
            aria-label="Toggle module preview"
            className="flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button type="button" onClick={handlePublish} disabled={isPublishing}
            aria-label="Publish module"
            className="flex items-center gap-1.5 rounded bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
            {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Publish
          </button>
          <button type="button" onClick={handleClose}
            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Close
          </button>
        </div>
      </div>

      {/* Module preview */}
      {showPreview && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-4">
          <SectionHeader title="Preview" />
          {blocks.map(block => (
            <BlockRenderer key={block.id} block={block} mode="preview" />
          ))}
        </div>
      )}

      {/* Metadata form */}
      <form onChange={scheduleAutosave} className="space-y-3">
        <SectionHeader title="Module Settings" />
        <FieldGroup cols={2}>
          <FormField label="Module Type" error={errors.moduleType?.message}>
            <input className={inputCls} placeholder="e.g. overview" {...register('moduleType')} />
          </FormField>
          <FormField label="Sub Title">
            <input className={inputCls} placeholder="Optional sub-title" {...register('subTitle')} />
          </FormField>
        </FieldGroup>
      </form>

      {/* Block list */}
      <div className="space-y-2">
        <SectionHeader title={`Blocks (${blocks.length})`} />
        {isLoading ? (
          <div className="space-y-2">{[0,1].map(i => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}</div>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">No blocks yet. Add one below.</p>
        ) : (
          <BlockList
            blocks={blocks}
            onReorder={reorderBlocks}
            expandedId={expandedId}
            onExpand={setExpandedId}
            onCollapse={() => setExpandedId(null)}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onToggleVisibility={toggleBlockVisibility}
            onUpdate={updateBlock}
          />
        )}
        {/* Add Block */}
        <div className="relative">
          <button type="button" onClick={() => setShowAddMenu(p => !p)}
            aria-label="Add block"
            className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Plus className="h-4 w-4" /> Add Block
          </button>
          {showAddMenu && (
            <div className="absolute left-0 right-0 z-10 mt-1">
              <AddBlockMenu
                onSelect={(blockType) => {
                  const { get: getReg } = require('@/lib/blocks/blockRegistry')
                  const def = getReg(blockType)
                  createBlock(blockType, def.defaultContent)
                  setShowAddMenu(false)
                }}
                onClose={() => setShowAddMenu(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => { if (!open) cancelDelete() }}
        title="Delete block?"
        description="This block will be soft-deleted."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
