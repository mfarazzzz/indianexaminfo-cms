/**
 * TimelineEventCard — renders one TimelineEvent in collapsed / editing / previewing state.
 *
 * Presentation-only: no service calls, no business logic.
 * Autosave wired via autosaveFnRef pattern (ARCHITECTURE.md §5.3).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { Pencil, Copy, Eye, Trash2, Check, Loader2, AlertCircle } from 'lucide-react'
import { TimelineEventSchema, type TimelineEventInput } from '@/lib/validation/entitySchemas'
import { useAutosave } from '@/hooks/useAutosave'
import { TimelineEventForm } from './TimelineEventForm'
import { TimelineEventPreview } from './TimelineEventPreview'
import type { TimelineEvent } from '@/types/entity'
import type { DragHandleProps } from '@/components/shared/DraggableList'
import { cn } from '@/lib/utils'

// ── Publish-state badge ───────────────────────────────────────────────────────

function PublishBadge({ event }: { event: TimelineEvent }) {
  if (event.status === 'active') {
    return <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">Live</span>
  }
  if (event.publishAt && new Date(event.publishAt) > new Date()) {
    const date = (() => { try { return format(parseISO(event.publishAt), 'd MMM') } catch { return '' } })()
    return <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">Scheduled {date}</span>
  }
  const cls: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-800', passed: 'bg-slate-100 text-slate-600',
    postponed: 'bg-yellow-100 text-yellow-800', cancelled: 'bg-red-100 text-red-800',
  }
  return <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', cls[event.status] ?? 'bg-slate-100 text-slate-600')}>{event.status}</span>
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TimelineEventCardProps {
  event: TimelineEvent
  isEditing: boolean
  isPreviewing: boolean
  onEdit: () => void
  onSave: (data: TimelineEventInput) => Promise<unknown>
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPreview: () => void
  onClosePreview: () => void
  dragHandleProps: DragHandleProps
  isDragging: boolean
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function TimelineEventCard({
  event, isEditing, isPreviewing,
  onEdit, onSave, onClose, onDelete, onDuplicate, onPreview, onClosePreview,
  dragHandleProps, isDragging,
}: TimelineEventCardProps) {

  const { handleSubmit, formState: { isDirty }, reset } = useForm<TimelineEventInput>({
    resolver: zodResolver(TimelineEventSchema),
    defaultValues: {
      title: event.title, eventType: event.eventType, eventDate: event.eventDate,
      eventTime: event.eventTime ?? undefined, description: event.description ?? undefined,
      status: event.status, badgeColor: event.badgeColor as TimelineEventInput['badgeColor'],
      isHighlighted: event.isHighlighted, isFeatured: event.isFeatured,
      officialLink: event.officialLink ?? undefined, pdfLink: event.pdfLink ?? undefined,
      visibility: event.visibility, displayOrder: event.displayOrder,
      publishAt: event.publishAt ?? undefined,
    },
  })

  // Reset when event data changes from server
  useEffect(() => { reset({ title: event.title, eventType: event.eventType, eventDate: event.eventDate }) }, [event.id, reset])

  // ── Autosave (ARCHITECTURE.md §5.3 pattern) ─────────────────────────────
  const autosaveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => { autosaveFnRef.current = handleSubmit(onSave) })
  const stableSaveFn = useCallback(() => autosaveFnRef.current(), [])
  const { status: autosaveStatus, lastSaved, scheduleAutosave, saveNow } = useAutosave(stableSaveFn, isEditing)

  // Saved indicator — clear after 3 s
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    if (autosaveStatus === 'saved') {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 3000)
      return () => clearTimeout(t)
    }
  }, [autosaveStatus])

  // ── Close with save-on-close ─────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    if (isDirty) await saveNow()
    onClose()
  }, [isDirty, saveNow, onClose])

  // Save on unmount if dirty
  useEffect(() => {
    return () => { if (isDirty) saveNow() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formattedDate = (() => {
    try { return format(parseISO(event.eventDate), 'd MMM yyyy') }
    catch { return event.eventDate }
  })()

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', isDragging && 'opacity-60 shadow-lg')}>

      {/* Collapsed header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle area (rendered by DraggableList via dragHandleProps) */}
        <button type="button" aria-label="Drag to reorder"
          className="cursor-grab text-slate-300 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
          {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </button>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
          <p className="text-xs text-slate-500">{formattedDate} · {event.eventType}</p>
        </div>

        {/* Autosave status */}
        {isEditing && (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            {autosaveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin text-slate-400" /><span className="text-slate-400">Saving…</span></>}
            {showSaved && <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">Saved</span></>}
            {autosaveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-red-500" /><span className="text-red-500">Autosave failed — retrying</span></>}
            {autosaveStatus === 'idle' && isDirty && <><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /><span className="text-amber-600">Unsaved changes</span></>}
          </div>
        )}

        <PublishBadge event={event} />

        {/* Action toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onEdit} aria-label="Edit timeline event"
            className="rounded p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Duplicate timeline event"
            className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={onPreview} aria-label="Preview timeline event"
            className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete timeline event"
            className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded: form */}
      {isEditing && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <TimelineEventForm
            defaultValues={{
              title: event.title, eventType: event.eventType, eventDate: event.eventDate,
              eventTime: event.eventTime ?? undefined, description: event.description ?? undefined,
              status: event.status, badgeColor: event.badgeColor as TimelineEventInput['badgeColor'],
              isHighlighted: event.isHighlighted, isFeatured: event.isFeatured,
              officialLink: event.officialLink ?? undefined, pdfLink: event.pdfLink ?? undefined,
              visibility: event.visibility, displayOrder: event.displayOrder,
              publishAt: event.publishAt ?? undefined,
            }}
            onSubmit={onSave}
            onCancel={handleClose}
            onScheduleAutosave={scheduleAutosave}
            isSubmitting={false}
          />
        </div>
      )}

      {/* Expanded: preview */}
      {isPreviewing && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <TimelineEventPreview event={event} onClose={onClosePreview} />
        </div>
      )}
    </div>
  )
}
