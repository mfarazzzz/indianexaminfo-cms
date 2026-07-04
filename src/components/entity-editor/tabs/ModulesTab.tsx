/**
 * ModulesTab — Entity-level module list.
 * Loading / error / empty / populated states.
 * Zero switch/case on moduleType. No db import.
 */
import React, { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useModulesTab } from '@/hooks/useModulesTab'
import { DraggableList } from '@/components/shared/DraggableList'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ModuleCard } from '@/components/entity-editor/modules/ModuleCard'
import { FormField, inputCls } from '@/components/shared/form/FormField'

interface ModulesTabProps { entityId: string }

function ModuleSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading modules">
      {[0,1,2].map(i => <div key={i} className="h-14 rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />)}
    </div>
  )
}

export function ModulesTab({ entityId }: ModulesTabProps) {
  const {
    modules, isLoading, error, refetch,
    isCreating, startCreate, cancelCreate, createModule, createError,
    deleteModule, duplicateModule, reorderModules, publishModule,
    expandedId, setExpandedId,
    pendingDeleteId, confirmDelete, cancelDelete,
  } = useModulesTab(entityId)

  const [newModuleType, setNewModuleType] = useState('')
  const [newSubTitle, setNewSubTitle] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await createModule({
      moduleType: newModuleType.trim(),
      subTitle: newSubTitle.trim() || null,
      displayOrder: modules.length,
      workflowStatus: 'draft',
      isFeatured: false,
      tags: [],
    })
    if (!createError) { setNewModuleType(''); setNewSubTitle('') }
  }

  if (isLoading) return <div className="p-6"><ModuleSkeleton /></div>

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
        <button type="button" onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          {modules.length} module{modules.length !== 1 ? 's' : ''}
        </h2>
        <button type="button" onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Plus className="h-4 w-4" /> Add Module
        </button>
      </div>

      {/* Inline create form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">New Module</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Module Type" required>
              <input className={inputCls} placeholder="e.g. overview" value={newModuleType}
                onChange={e => setNewModuleType(e.target.value)} autoFocus />
            </FormField>
            <FormField label="Sub Title" hint="Required if same type exists">
              <input className={inputCls} placeholder="Optional" value={newSubTitle}
                onChange={e => setNewSubTitle(e.target.value)} />
            </FormField>
          </div>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={!newModuleType.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Create
            </button>
            <button type="button" onClick={cancelCreate}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {modules.length === 0 && !isCreating && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <p className="text-sm text-slate-500">No modules yet</p>
          <button type="button" onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Plus className="h-4 w-4" /> Add First Module
          </button>
        </div>
      )}

      {/* Module list */}
      {modules.length > 0 && (
        <DraggableList
          items={modules}
          onReorder={reorderModules}
          showDefaultHandle={false}
          renderItem={(module, { dragHandleProps, isDragging }) => (
            <ModuleCard
              module={module}
              isExpanded={expandedId === module.id}
              onExpand={() => setExpandedId(module.id)}
              onCollapse={() => setExpandedId(null)}
              onDelete={() => deleteModule(module.id)}
              onDuplicate={() => duplicateModule(module.id)}
              onPublish={publishModule}
              dragHandleProps={dragHandleProps}
              isDragging={isDragging}
            />
          )}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => { if (!open) cancelDelete() }}
        title="Delete module?"
        description="This module and all its blocks will be soft-deleted."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
