import React from 'react'
import { CalendarDays } from 'lucide-react'
import type { TimelineReferenceContent } from '@/lib/blocks/schemas/timelineReferenceSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function TimelineReferenceRenderer({ content }: BlockRendererProps) {
  const { eventIds = [] } = content as TimelineReferenceContent
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <CalendarDays className="h-5 w-5 text-blue-500 shrink-0" />
      <p className="text-sm text-slate-600">
        {eventIds.length === 0
          ? 'No timeline events referenced.'
          : `${eventIds.length} timeline event${eventIds.length !== 1 ? 's' : ''} referenced.`}
      </p>
    </div>
  )
}
