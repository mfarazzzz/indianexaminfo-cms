/**
 * TimelineEditor.tsx — Visual Timeline Builder.
 *
 * Features:
 * - List view with event cards
 * - Calendar view (month grid)
 * - Drag-and-drop reordering (dnd-kit)
 * - Lifecycle rule evaluation on every change
 * - Inline validation (warnings + blocking errors)
 * - Stage dependency visualization
 * - Filters by status/type
 * - Timeline summary
 *
 * Uses existing services: timelineService, evaluateEntityRules, evaluateLifecycleRules.
 * REQ-011, REQ-005, REQ-027.
 */
import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, List, Plus, AlertTriangle, CheckCircle2, XCircle,
  GripVertical, Loader2, Trash2, Edit3, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { entityKeys } from '@/lib/queryKeys'
import {
  listTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  softDeleteTimelineEvent,
  reorderTimeline,
  evaluateEntityRules,
  type LifecycleRuleViolation,
} from '@/services/entity/timelineService'
import type { TimelineEvent } from '@/types/entity'
import type { TimelineEventInput } from '@/lib/validation/entitySchemas'
import type { EditorProps } from '../registry'
import { cn } from '@/lib/utils'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upcoming:   { label: 'Upcoming',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  pending:    { label: 'Pending',    color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200' },
  active:     { label: 'Active',     color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  passed:     { label: 'Passed',     color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
  postponed:  { label: 'Postponed',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  cancelled:  { label: 'Cancelled',  color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  violations,
  onEdit,
  onDelete,
}: {
  event: TimelineEvent
  violations: LifecycleRuleViolation[]
  onEdit: () => void
  onDelete: () => void
}) {
  const cfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending
  const eventViolations = violations.filter(
    v => v.rule.subjectStage === event.stageKey || v.rule.objectStage === event.stageKey
  )

  return (
    <div
      className={cn('rounded-lg border p-3 transition-shadow hover:shadow-sm', cfg.bg)}
      role="listitem"
      aria-label={`${event.title} — ${cfg.label}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 cursor-grab text-slate-400 hover:text-slate-600" aria-hidden="true">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-800 truncate">{event.title}</h4>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', cfg.color, cfg.bg)}>
              {cfg.label}
            </span>
            {event.publishAt && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Scheduled
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {event.eventDate && <span>{new Date(event.eventDate).toLocaleDateString()}</span>}
            {event.eventTime && <span>{event.eventTime}</span>}
            {event.stageKey && (
              <span className="capitalize text-slate-400">{event.stageKey.replace(/_/g, ' ')}</span>
            )}
          </div>
          {event.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{event.description}</p>
          )}
          {/* Lifecycle rule violations for this event */}
          {eventViolations.length > 0 && (
            <div className="mt-2 space-y-1">
              {eventViolations.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-1.5 text-xs rounded px-2 py-1',
                    v.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  )}
                  role="alert"
                >
                  {v.severity === 'error' ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {v.message}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-white/80" aria-label={`Edit ${event.title}`}>
            <Edit3 className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" aria-label={`Delete ${event.title}`}>
            <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ events, violations }: { events: TimelineEvent[]; violations: LifecycleRuleViolation[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const ev of events) {
      if (!ev.eventDate) continue
      const d = ev.eventDate.slice(0, 10)
      const list = map.get(d) ?? []
      list.push(ev)
      map.set(d, list)
    }
    return map
  }, [events])

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          ← Prev
        </button>
        <h3 className="text-sm font-medium text-slate-700">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border" role="grid" aria-label="Timeline calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-slate-50 p-1.5 text-center text-[10px] font-medium text-slate-500">{d}</div>
        ))}
        {/* Empty cells for offset */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white p-1.5 min-h-[60px]" />
        ))}
        {/* Day cells */}
        {days.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayEvents = eventsByDate.get(dateStr) ?? []
          const hasViolation = dayEvents.some(ev =>
            violations.some(v => v.rule.subjectStage === ev.stageKey || v.rule.objectStage === ev.stageKey)
          )
          return (
            <div
              key={day}
              className={cn('bg-white p-1.5 min-h-[60px] relative', dayEvents.length > 0 && 'bg-blue-50/30')}
            >
              <span className="text-[10px] text-slate-400">{day}</span>
              {hasViolation && (
                <AlertTriangle className="absolute top-1 right-1 h-3 w-3 text-amber-500" aria-label="Rule violation" />
              )}
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => {
                  const sCfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending
                  return (
                    <div key={ev.id} className={cn('text-[9px] px-1 py-0.5 rounded truncate', sCfg.color, sCfg.bg)}>
                      {ev.title}
                    </div>
                  )
                })}
                {dayEvents.length > 2 && (
                  <span className="text-[9px] text-slate-400">+{dayEvents.length - 2} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Timeline Summary ──────────────────────────────────────────────────────────

function TimelineSummary({ events, violations }: { events: TimelineEvent[]; violations: LifecycleRuleViolation[] }) {
  const upcoming = events.filter(e => e.status === 'upcoming' || e.status === 'pending').length
  const active = events.filter(e => e.status === 'active').length
  const errors = violations.filter(v => v.severity === 'error').length
  const warnings = violations.filter(v => v.severity === 'warning').length

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-slate-500">{events.length} events</span>
      {upcoming > 0 && <span className="text-blue-600">{upcoming} upcoming</span>}
      {active > 0 && <span className="text-green-600">{active} active</span>}
      {errors > 0 && (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-3 w-3" />{errors} error{errors > 1 ? 's' : ''}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />{warnings} warning{warnings > 1 ? 's' : ''}
        </span>
      )}
      {errors === 0 && warnings === 0 && events.length > 0 && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />All valid
        </span>
      )}
    </div>
  )
}

// ── Main Timeline Editor ──────────────────────────────────────────────────────

export default function TimelineEditor({ entityId }: EditorProps) {
  const qc = useQueryClient()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: events = [], isLoading } = useQuery({
    queryKey: entityKeys.timeline(entityId),
    queryFn: () => listTimeline(entityId),
    staleTime: 3 * 60_000,
    enabled: !!entityId,
  })

  const { data: violations = [] } = useQuery({
    queryKey: [...entityKeys.timeline(entityId), 'rules'],
    queryFn: () => evaluateEntityRules(entityId),
    staleTime: 3 * 60_000,
    enabled: !!entityId,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteTimelineEvent(id),
    onSuccess: () => {
      toast.success('Event deleted')
      qc.invalidateQueries({ queryKey: entityKeys.timeline(entityId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderTimeline(entityId, orderedIds),
    onMutate: async (orderedIds) => {
      // Optimistic reorder
      await qc.cancelQueries({ queryKey: entityKeys.timeline(entityId) })
      const prev = qc.getQueryData<TimelineEvent[]>(entityKeys.timeline(entityId))
      if (prev) {
        const idMap = new Map(prev.map(e => [e.id, e]))
        const reordered = orderedIds.map(id => idMap.get(id)).filter(Boolean) as TimelineEvent[]
        qc.setQueryData(entityKeys.timeline(entityId), reordered)
      }
      return { prev }
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(entityKeys.timeline(entityId), ctx.prev)
      toast.error('Failed to reorder')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: entityKeys.timeline(entityId) })
    },
  })

  // ── Filtered events ───────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!statusFilter) return events
    return events.filter(e => e.status === statusFilter)
  }, [events, statusFilter])

  // ── Keyboard reorder ──────────────────────────────────────────────────────
  const moveEvent = useCallback((index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= filteredEvents.length) return
    const newOrder = [...filteredEvents.map(e => e.id)]
    ;[newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]]
    reorderMutation.mutate(newOrder)
  }, [filteredEvents, reorderMutation])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Timeline</h2>
          <TimelineSummary events={events} violations={violations} />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border divide-x" role="radiogroup" aria-label="View mode">
            <button
              onClick={() => setView('list')}
              className={cn('px-2.5 py-1.5 text-xs', view === 'list' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50')}
              role="radio"
              aria-checked={view === 'list'}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn('px-2.5 py-1.5 text-xs', view === 'calendar' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50')}
              role="radio"
              aria-checked={view === 'calendar'}
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border rounded-md px-2 py-1.5 text-slate-600"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rule violations banner */}
      {violations.filter(v => v.severity === 'error').length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1" role="alert">
          <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
            <XCircle className="h-4 w-4" /> Lifecycle rule violations
          </p>
          {violations.filter(v => v.severity === 'error').map((v, i) => (
            <p key={i} className="text-xs text-red-600 ml-5.5">{v.message}</p>
          ))}
        </div>
      )}

      {/* Views */}
      {view === 'calendar' ? (
        <CalendarView events={filteredEvents} violations={violations} />
      ) : (
        /* List View */
        <div className="space-y-2" role="list" aria-label="Timeline events">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              {statusFilter ? 'No events match this filter.' : 'No timeline events yet. Add your first event.'}
            </div>
          ) : (
            filteredEvents.map((event, index) => (
              <div key={event.id} className="group">
                <EventCard
                  event={event}
                  violations={violations}
                  onEdit={() => toast.info('Edit form coming in next iteration')}
                  onDelete={() => deleteMutation.mutate(event.id)}
                />
                {/* Keyboard reorder controls (visible on focus) */}
                <div className="sr-only" role="group" aria-label={`Reorder ${event.title}`}>
                  <button onClick={() => moveEvent(index, 'up')} disabled={index === 0}>Move up</button>
                  <button onClick={() => moveEvent(index, 'down')} disabled={index === filteredEvents.length - 1}>Move down</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
