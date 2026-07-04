/**
 * ModuleCard — Collapsed/expanded module card.
 * Collapsed: summary + actions. Expanded: renders ModuleEditor.
 */
import React from 'react'
import { ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import type { EntityModule } from '@/types/entity'
import type { DragHandleProps } from '@/components/shared/DraggableList'
import { cn } from '@/lib/utils'

// ModuleEditor imported lazily to avoid circular deps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModuleEditorLazy = React.lazy(() =>
  import('./ModuleEditor').then(m => ({ default: m.ModuleEditor }))
)

interface ModuleCardProps {
  module: EntityModule
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPublish: (moduleId: string, userId: string) => Promise<void>
  dragHandleProps: DragHandleProps
  isDragging: boolean
}

const STATUS_COLORS: Record<string, string> = {
  draft:        'bg-slate-100 text-slate-600',
  in_review:    'bg-yellow-100 text-yellow-700',
  published:    'bg-green-100 text-green-700',
  archived:     'bg-red-100 text-red-700',
  scheduled:    'bg-blue-100 text-blue-700',
  seo_review:   'bg-purple-100 text-purple-700',
  legal_review: 'bg-orange-100 text-orange-700',
}

export function ModuleCard({
  module, isExpanded, onExpand, onCollapse,
  onDelete, onDuplicate, onPublish, dragHandleProps, isDragging,
}: ModuleCardProps) {
  const statusCls = STATUS_COLORS[module.workflowStatus] ?? STATUS_COLORS.draft

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', isDragging && 'opacity-60 shadow-lg')}>
      {/* Header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <button type="button" aria-label="Drag to reorder module"
          className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </button>

        {/* Module info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-900 truncate">{module.moduleType}</span>
            {module.subTitle && <span className="text-xs text-slate-500 truncate">— {module.subTitle}</span>}
          </div>
        </div>

        {/* Status chip */}
        <span className={cn('rounded px-2 py-0.5 text-xs font-medium shrink-0', statusCls)}>
          {module.workflowStatus.replace(/_/g, ' ')}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onDuplicate} aria-label="Duplicate module"
            className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete module"
            className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={isExpanded ? onCollapse : onExpand}
            aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
            className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: ModuleEditor */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          <React.Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading editor…</div>}>
            <ModuleEditorLazy
              moduleId={module.id}
              onRequestClose={onCollapse}
              onPublish={onPublish}
            />
          </React.Suspense>
        </div>
      )}
    </div>
  )
}
