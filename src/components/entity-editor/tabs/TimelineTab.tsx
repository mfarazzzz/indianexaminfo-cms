/**
 * TimelineTab — orchestrator shell for the Timeline editor.
 *
 * Pure wiring: reads all state from useTimelineTab, renders the
 * appropriate UI state, and passes callbacks down to cards.
 * No business logic, no direct Supabase access.
 */
import React, { useEffect } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useTimelineTab } from '@/hooks/useTimelineTab'
import { ensureStandardDates } from '@/services/entity/timelineService'
import { STANDARD_DATE_TYPES } from '@/types/entity'
import { DraggableList } from '@/components/shared/DraggableList'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TimelineEventCard } from '@/components/entity-editor/timeline/TimelineEventCard'
import { TimelineEventForm } from '@/components/entity-editor/timeline/TimelineEventForm'
import type { TimelineEventInput } from '@/lib/validation/entitySchemas'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading timeline events">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-16 rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />
      ))}
    </div>
  )
}

// ── TimelineTab ───────────────────────────────────────────────────────────────

export function TimelineTab({ entityId }: { entityId: string }) {
  const {
    events, isLoading, error, refetch,
    isAddingNew, startAddNew, cancelAddNew, createEvent,
    editingId, setEditingId, previewingId, setPreviewingId,
    updateEvent, deleteEvent, duplicateEvent, reorder,
    pendingDeleteId, confirmDelete, cancelDelete,
  } = useTimelineTab(entityId)

  // Ensure standard date rows exist on mount (Req 1.2)
  useEffect(() => {
    if (entityId) {
      ensureStandardDates(entityId).catch(() => {
        // Non-fatal: if ensure fails, the tab still works with existing rows
      })
    }
  }, [entityId])

  // Determine which events are standard (non-deletable)
  const standardSet = new Set<string>(STANDARD_DATE_TYPES)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-6"><TimelineSkeleton /></div>

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 space-y-3">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (events.length === 0 && !isAddingNew) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <p className="text-sm text-slate-500">No timeline events yet</p>
          <button
            type="button"
            onClick={startAddNew}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add First Event
          </button>
        </div>
        {isAddingNew && <NewEventInline entityId={entityId} createEvent={createEvent} cancelAddNew={cancelAddNew} eventsLength={0} />}
      </div>
    )
  }

  // ── Loaded state ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </h2>
        <button
          type="button"
          onClick={startAddNew}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {/* Event list */}
      <DraggableList
        items={events}
        onReorder={reorder}
        showDefaultHandle={false}
        renderItem={(event, { dragHandleProps, isDragging }) => (
          <TimelineEventCard
            event={event}
            isEditing={editingId === event.id}
            isPreviewing={previewingId === event.id}
            onEdit={() => setEditingId(event.id)}
            onSave={(data: TimelineEventInput) => updateEvent(event.id, data)}
            onClose={() => setEditingId(null)}
            onDelete={() => deleteEvent(event.id)}
            onDuplicate={() => duplicateEvent(event)}
            onPreview={() => setPreviewingId(event.id)}
            onClosePreview={() => setPreviewingId(null)}
            dragHandleProps={dragHandleProps}
            isDragging={isDragging}
          />
        )}
      />

      {/* New event inline form */}
      {isAddingNew && (
        <NewEventInline
          entityId={entityId}
          createEvent={createEvent}
          cancelAddNew={cancelAddNew}
          eventsLength={events.length}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => { if (!open) cancelDelete() }}
        title="Delete timeline event?"
        description="This event will be soft-deleted and removed from the timeline. This action can be reversed by an admin."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}

// ── New event inline ──────────────────────────────────────────────────────────

function NewEventInline({
  createEvent,
  cancelAddNew,
  eventsLength,
}: {
  entityId: string
  createEvent: (input: TimelineEventInput) => Promise<void>
  cancelAddNew: () => void
  eventsLength: number
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-4 pb-4">
      <p className="pt-3 text-xs font-medium text-blue-700 uppercase tracking-wide">New Event</p>
      <TimelineEventForm
        defaultValues={{ displayOrder: eventsLength, status: 'upcoming', badgeColor: 'blue', visibility: 'public', isHighlighted: false, isFeatured: false }}
        onSubmit={createEvent}
        onCancel={cancelAddNew}
        onScheduleAutosave={() => {}}
        isSubmitting={false}
      />
    </div>
  )
}
