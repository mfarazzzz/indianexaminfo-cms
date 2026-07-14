/**
 * TimelineEditor.tsx — Timeline events CRUD with lifecycle rule evaluation.
 *
 * Delegates to existing TimelineTab which already integrates:
 * - listTimeline / createTimelineEvent / updateTimelineEvent / softDeleteTimelineEvent
 * - reorderTimeline (drag-and-drop)
 * - Timeline event form with Zod validation
 * - Status badges (postponed/cancelled)
 * - Scheduled publish_at handling
 *
 * REQ-011: Timeline Builder
 */
import React from 'react'
import type { EditorProps } from '../registry'

// Existing TimelineTab from entity-editor — reused directly
const TimelineTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/TimelineTab').then(m => ({ default: m.TimelineTab }))
)

export default function TimelineEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <TimelineTab entityId={entityId} />
    </React.Suspense>
  )
}
