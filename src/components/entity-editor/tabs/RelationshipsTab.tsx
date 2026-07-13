/**
 * RelationshipsTab.tsx — Manage typed entity relationships.
 * Groups outgoing relationships by type. Shows incoming as read-only.
 */
import { useState } from 'react'
import { Plus, Trash2, GripVertical, ExternalLink } from 'lucide-react'
import { useRelationshipsTab } from '@/hooks/useRelationshipsTab'
import { DraggableList } from '@/components/shared/DraggableList'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { EntityRelationshipWithDirection, RelationshipInput } from '@/types/entity-relationship'

// ── Relationship type labels ──────────────────────────────────────────────────
const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  parent_exam:        'Parent Exam',
  child_exam:         'Child Exam',
  related_exam:       'Related Exam',
  supersedes:         'Supersedes',
  prerequisite:       'Prerequisite',
  references:         'References',
  associated_news:    'Associated News',
  associated_result:  'Associated Result',
  associated_blog:    'Associated Blog',
  related_university: 'Related University',
}

const RELATIONSHIP_TYPE_OPTIONS = Object.entries(RELATIONSHIP_TYPE_LABELS)

// ── Add relationship form ─────────────────────────────────────────────────────
interface AddRelationshipFormProps {
  sourceEntityId: string
  onAdd: (input: RelationshipInput) => void
  onCancel: () => void
  isAdding: boolean
}

function AddRelationshipForm({ sourceEntityId, onAdd, onCancel, isAdding }: AddRelationshipFormProps) {
  const [relationshipType, setRelationshipType] = useState('related_exam')
  const [targetEntityId, setTargetEntityId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetEntityId.trim()) return
    onAdd({ sourceEntityId, targetEntityId: targetEntityId.trim(), relationshipType })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-white space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Relationship Type</label>
          <select
            value={relationshipType}
            onChange={e => setRelationshipType(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5"
          >
            {RELATIONSHIP_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target Entity ID</label>
          <input
            type="text"
            value={targetEntityId}
            onChange={e => setTargetEntityId(e.target.value)}
            placeholder="Paste entity UUID…"
            className="w-full text-sm border rounded px-2 py-1.5"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={isAdding || !targetEntityId.trim()}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {isAdding ? 'Adding…' : 'Add Relationship'}
        </button>
      </div>
    </form>
  )
}

// ── Relationship card ─────────────────────────────────────────────────────────
interface RelationshipCardProps {
  relationship: EntityRelationshipWithDirection
  onDelete: (id: string) => void
  dragHandle: React.ReactNode
}

function RelationshipCard({ relationship, onDelete, dragHandle }: RelationshipCardProps) {
  const { targetEntity } = relationship
  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg group">
      <div className="text-gray-300 cursor-grab">{dragHandle}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{targetEntity.name}</p>
        <p className="text-xs text-gray-400 truncate">{targetEntity.pillar} · {targetEntity.workflowStatus}</p>
      </div>
      <a href={`/entities/${targetEntity.pillar}/${targetEntity.id}`}
        className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Open entity">
        <ExternalLink className="h-4 w-4" />
      </a>
      <button onClick={() => onDelete(relationship.id)}
        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
interface RelationshipsTabProps { entityId: string }

export function RelationshipsTab({ entityId }: RelationshipsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false)

  const {
    groupedOutgoing,
    incoming,
    isLoading,
    createRelationship,
    isCreating,
    createError,
    reorder,
    stageDelete,
    pendingDeleteId,
    confirmDelete,
    cancelDelete,
  } = useRelationshipsTab(entityId)

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading relationships…</div>
  }

  const handleAdd = (input: RelationshipInput) => {
    createRelationship(input, {
      onSuccess: () => setShowAddForm(false),
    })
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Relationships</h2>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Add Relationship
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddRelationshipForm
          sourceEntityId={entityId}
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isAdding={isCreating}
        />
      )}
      {createError && (
        <p className="text-sm text-red-600">{(createError as Error).message}</p>
      )}

      {/* Outgoing relationships grouped by type */}
      {groupedOutgoing.size === 0 && !showAddForm && (
        <p className="text-sm text-gray-400">No outgoing relationships. Add one above.</p>
      )}

      {Array.from(groupedOutgoing.entries()).map(([type, items]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600">
            {RELATIONSHIP_TYPE_LABELS[type] ?? type}
            <span className="ml-2 text-xs text-gray-400">({items.length})</span>
          </h3>
          <DraggableList
            items={items}
            onReorder={orderedIds => reorder(orderedIds)}
            renderItem={(item, props) => (
              <RelationshipCard
                key={item.id}
                relationship={item}
                onDelete={(id) => stageDelete(id)}
                dragHandle={<GripVertical className="h-4 w-4" />}
              />
            )}
          />
        </div>
      ))}

      {/* Incoming (read-only) */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Incoming References</h3>
          <p className="text-xs text-gray-400">Other entities that reference this one (read-only)</p>
          <div className="space-y-2">
            {incoming.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{r.targetEntity.name}</p>
                  <p className="text-xs text-gray-400">
                    {RELATIONSHIP_TYPE_LABELS[r.relationshipType] ?? r.relationshipType}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={o => { if (!o) cancelDelete() }}
        title="Remove Relationship"
        description="Remove this relationship? This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmDelete()}
      />
    </div>
  )
}
