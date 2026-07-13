/**
 * TimelineEventPreview — Read-only preview of a timeline event.
 *
 * Pure display component. Zero network calls. Escape or close button to dismiss.
 */
import React, { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { X, ExternalLink, FileText } from 'lucide-react'
import type { TimelineEvent } from '@/types/entity'
import { cn } from '@/lib/utils'

const BADGE_COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-800',
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  red:    'bg-red-100 text-red-800',
  grey:   'bg-slate-100 text-slate-600',
}

export interface TimelineEventPreviewProps {
  event: TimelineEvent
  onClose: () => void
}

export function TimelineEventPreview({ event, onClose }: TimelineEventPreviewProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const formattedDate = (() => {
    try { return event.eventDate ? format(parseISO(event.eventDate), 'd MMM yyyy') : 'TBD' }
    catch { return event.eventDate ?? 'TBD' }
  })()

  const badgeCls = BADGE_COLOR_MAP[event.badgeColor] ?? BADGE_COLOR_MAP.blue

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 leading-tight">{event.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700">
              {event.eventType}
            </span>
            <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', badgeCls)}>
              {event.status}
            </span>
            <span className="text-xs text-slate-500">{formattedDate}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
      )}

      {/* Links */}
      {(event.officialLink || event.pdfLink) && (
        <div className="flex items-center gap-3 pt-1">
          {event.officialLink && (
            <a href={event.officialLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ExternalLink className="h-3.5 w-3.5" />
              Official Link
            </a>
          )}
          {event.pdfLink && (
            <a href={event.pdfLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <FileText className="h-3.5 w-3.5" />
              Download PDF
            </a>
          )}
        </div>
      )}
    </div>
  )
}
