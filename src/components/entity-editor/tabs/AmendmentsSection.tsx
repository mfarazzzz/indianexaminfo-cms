/**
 * AmendmentsSection.tsx — Amendments tab for the entity editor.
 * Displays corrigendum records. Editors create, publish, reorder, delete amendments.
 * Published amendments are shown to readers as "Updated On / What's Changed".
 */
import { useState } from 'react'
import { Plus, Trash2, GripVertical, Send } from 'lucide-react'
import { useAmendmentsSection } from '@/hooks/useAmendmentsSection'
import { DraggableList } from '@/components/shared/DraggableList'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { EntityAmendment, AmendmentInput } from '@/types/entity-amendment'

// ── Amendment form ────────────────────────────────────────────────────────────
interface AmendmentFormProps {
  entityId: string
  initial?: Partial<AmendmentInput>
  onSave: (input: AmendmentInput) => void
  onCancel: () => void
  isSaving: boolean
}

function AmendmentForm({ entityId, initial, onSave, onCancel, isSaving }: AmendmentFormProps) {
  const [title, setTitle]               = useState(initial?.title ?? '')
  const [changeSummary, setChangeSummary] = useState(initial?.changeSummary ?? '')
  const [effectiveDate, setEffectiveDate] = useState(initial?.effectiveDate ?? '')
  const [errors, setErrors]             = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!title.trim())         errs.title         = 'Title is required'
    if (!changeSummary.trim()) errs.changeSummary = 'Change summary is required'
    if (!effectiveDate)        errs.effectiveDate = 'Effective date is required'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    onSave({ entityId, title: title.trim(), changeSummary: changeSummary.trim(), effectiveDate })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-white space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Application end date changed to March 20"
          className={cn('w-full text-sm border rounded px-2 py-1.5', errors.title && 'border-red-400')}
        />
        {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Change Summary <span className="text-red-500">*</span>
        </label>
        <textarea
          value={changeSummary}
          onChange={e => setChangeSummary(e.target.value)}
          rows={2}
          placeholder="Brief description of what changed and why…"
          className={cn('w-full text-sm border rounded px-2 py-1.5 resize-none', errors.changeSummary && 'border-red-400')}
        />
        {errors.changeSummary && <p className="text-xs text-red-500 mt-0.5">{errors.changeSummary}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Effective Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={effectiveDate}
          onChange={e => setEffectiveDate(e.target.value)}
          className={cn('text-sm border rounded px-2 py-1.5', errors.effectiveDate && 'border-red-400')}
        />
        {errors.effectiveDate && <p className="text-xs text-red-500 mt-0.5">{errors.effectiveDate}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={isSaving}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {isSaving ? 'Saving…' : 'Save Amendment'}
        </button>
      </div>
    </form>
  )
}

// ── Amendment card ────────────────────────────────────────────────────────────
interface AmendmentCardProps {
  amendment: EntityAmendment
  onPublish: (id: string) => void
  onDelete: (id: string) => void
  dragHandle: React.ReactNode
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-red-100 text-red-600',
}

function AmendmentCard({ amendment, onPublish, onDelete, dragHandle }: AmendmentCardProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white border rounded-lg group">
      <div className="text-gray-300 cursor-grab mt-0.5">{dragHandle}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">{amendment.title}</p>
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', STATUS_BADGE[amendment.workflowStatus])}>
            {amendment.workflowStatus}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{amendment.changeSummary}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Effective: {new Date(amendment.effectiveDate).toLocaleDateString()}
          {amendment.publishedDate && (
            <> · Published: {new Date(amendment.publishedDate).toLocaleDateString()}</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {amendment.workflowStatus === 'draft' && (
          <button onClick={() => onPublish(amendment.id)}
            title="Publish amendment"
            className="text-blue-500 hover:text-blue-700">
            <Send className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDelete(amendment.id)}
          title="Delete amendment"
          className="text-gray-400 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
interface AmendmentsSectionProps { entityId: string }

export function AmendmentsSection({ entityId }: AmendmentsSectionProps) {
  const [showForm, setShowForm] = useState(false)

  const {
    amendments,
    publishedCount,
    isLoading,
    createAmendment,
    isCreating,
    publishAmendment,
    reorder,
    stageDelete,
    pendingDeleteId,
    confirmDelete,
    cancelDelete,
  } = useAmendmentsSection(entityId)

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading amendments…</div>
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Amendments
            {publishedCount > 0 && (
              <span className="ml-2 text-sm font-normal text-green-600">
                ({publishedCount} published)
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Published amendments appear as "What's Changed" on the frontend
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Amendment
          </button>
        )}
      </div>

      {showForm && (
        <AmendmentForm
          entityId={entityId}
          onSave={input => {
            createAmendment(input, { onSuccess: () => setShowForm(false) })
          }}
          onCancel={() => setShowForm(false)}
          isSaving={isCreating}
        />
      )}

      {amendments.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400">No amendments yet.</p>
      ) : (
        <DraggableList
          items={amendments}
          onReorder={orderedIds => reorder(orderedIds)}
          renderItem={(amendment, props) => (
            <AmendmentCard
              key={amendment.id}
              amendment={amendment}
              onPublish={publishAmendment}
              onDelete={id => stageDelete(id)}
              dragHandle={<GripVertical className="h-4 w-4" />}
            />
          )}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={o => { if (!o) cancelDelete() }}
        title="Delete Amendment"
        description="Delete this amendment? Published amendments will no longer appear on the frontend."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete()}
      />
    </div>
  )
}
