/**
 * useTimelineTab — orchestration hook for TimelineTab.
 *
 * Owns: data fetching, all mutations, optimistic delete, UI state
 * (editingId, previewingId, isAddingNew, pendingDeleteId).
 *
 * Components are pure renderers. No business logic lives here —
 * that belongs in timelineService.ts.
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { entityKeys } from '@/lib/queryKeys'
import { useSatelliteQuery, useReorderMutation } from '@/hooks/useEntityQuery'
import {
  listTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  softDeleteTimelineEvent,
  reorderTimeline,
} from '@/services/entity/timelineService'
import type { TimelineEvent } from '@/types/entity'
import type { TimelineEventInput } from '@/lib/validation/entitySchemas'

export interface UseTimelineTabReturn {
  // Data
  events: TimelineEvent[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  // Add new
  isAddingNew: boolean
  startAddNew: () => void
  cancelAddNew: () => void
  createEvent: (input: TimelineEventInput) => Promise<void>
  // Per-card UI state
  editingId: string | null
  setEditingId: (id: string | null) => void
  previewingId: string | null
  setPreviewingId: (id: string | null) => void
  // Mutations
  updateEvent: (id: string, input: Partial<TimelineEventInput>) => Promise<TimelineEvent>
  deleteEvent: (id: string) => void
  duplicateEvent: (event: TimelineEvent) => Promise<void>
  reorder: (orderedIds: string[]) => void
  // Delete confirm dialog
  pendingDeleteId: string | null
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
}

export function useTimelineTab(entityId: string): UseTimelineTabReturn {
  const qc = useQueryClient()
  const queryKey = entityKeys.timeline(entityId)

  // ── Data ───────────────────────────────────────────────────────────────────

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useSatelliteQuery<TimelineEvent[]>(
    entityId,
    queryKey,
    () => listTimeline(entityId)
  )
  const events = data ?? []

  // ── UI state ───────────────────────────────────────────────────────────────

  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingIdRaw] = useState<string | null>(null)
  const [previewingId, setPreviewingIdRaw] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Only one card open at a time
  const setEditingId = useCallback((id: string | null) => {
    setEditingIdRaw(id)
    if (id) { setPreviewingIdRaw(null); setIsAddingNew(false) }
  }, [])

  const setPreviewingId = useCallback((id: string | null) => {
    setPreviewingIdRaw(id)
    if (id) { setEditingIdRaw(null); setIsAddingNew(false) }
  }, [])

  const startAddNew = useCallback(() => {
    setIsAddingNew(true)
    setEditingIdRaw(null)
    setPreviewingIdRaw(null)
  }, [])

  const cancelAddNew = useCallback(() => setIsAddingNew(false), [])

  // ── Create ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (input: TimelineEventInput) => createTimelineEvent(entityId, input),
    onSuccess: () => {
      setIsAddingNew(false)
      qc.invalidateQueries({ queryKey })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createEvent = useCallback(
    async (input: TimelineEventInput): Promise<void> => {
      await createMutation.mutateAsync(input).catch(() => {})
    },
    [createMutation]
  )

  // ── Update ─────────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TimelineEventInput> }) =>
      updateTimelineEvent(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const updateEvent = useCallback(
    (id: string, input: Partial<TimelineEventInput>) =>
      updateMutation.mutateAsync({ id, input }),
    [updateMutation]
  )

  // ── Delete (optimistic) ────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteTimelineEvent(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<TimelineEvent[]>(queryKey)
      qc.setQueryData<TimelineEvent[]>(queryKey, prev => (prev ?? []).filter(e => e.id !== id))
      return { previous }
    },
    onError: (_err: Error, _id, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous)
      toast.error('Failed to delete event — change restored')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const deleteEvent = useCallback((id: string) => setPendingDeleteId(id), [])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    const idToDelete = pendingDeleteId
    setPendingDeleteId(null)
    await deleteMutation.mutateAsync(idToDelete).catch(() => {})
  }, [pendingDeleteId, deleteMutation])

  const cancelDelete = useCallback(() => setPendingDeleteId(null), [])

  // ── Duplicate ──────────────────────────────────────────────────────────────

  const duplicateMutation = useMutation({
    mutationFn: (event: TimelineEvent) => {
      const input: TimelineEventInput = {
        title: event.title, eventType: event.eventType, eventDate: event.eventDate,
        eventTime: event.eventTime ?? undefined, description: event.description ?? undefined,
        status: event.status, badgeColor: event.badgeColor as TimelineEventInput['badgeColor'],
        isHighlighted: event.isHighlighted, isFeatured: event.isFeatured,
        officialLink: event.officialLink ?? undefined, pdfLink: event.pdfLink ?? undefined,
        visibility: event.visibility, displayOrder: events.length,
      }
      return createTimelineEvent(entityId, input)
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey })
      setEditingId(created.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const duplicateEvent = useCallback(
    async (event: TimelineEvent): Promise<void> => {
      await duplicateMutation.mutateAsync(event).catch(() => {})
    },
    [duplicateMutation]
  )

  // ── Reorder ────────────────────────────────────────────────────────────────

  const reorderMutation = useReorderMutation<TimelineEvent>(
    queryKey,
    (ids) => reorderTimeline(entityId, ids)
  )

  const reorder = useCallback(
    (orderedIds: string[]) => reorderMutation.mutate(orderedIds),
    [reorderMutation]
  )

  return {
    events, isLoading, error: error as Error | null, refetch,
    isAddingNew, startAddNew, cancelAddNew, createEvent,
    editingId, setEditingId, previewingId, setPreviewingId,
    updateEvent, deleteEvent, duplicateEvent, reorder,
    pendingDeleteId, confirmDelete, cancelDelete,
  }
}
