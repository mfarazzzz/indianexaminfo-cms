/**
 * ReadOnlyDateChip — Displays a date from TimelineDatesContext as a non-editable chip.
 * Shows "Not set" for null dates, formatted DD MMM YYYY for set dates.
 * Includes "Edit in Timeline →" navigation link. (Req 1.4, 3.4)
 */
import React from 'react'
import { Calendar, ArrowRight } from 'lucide-react'
import { useTimelineDates } from '@/contexts/TimelineDatesContext'
import { STANDARD_DATE_LABELS } from '@/types/entity'
import type { StandardDateType } from '@/types/entity'

interface ReadOnlyDateChipProps {
  eventType: string
  label?: string
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return 'Not set'
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function ReadOnlyDateChip({ eventType, label }: ReadOnlyDateChipProps) {
  const { dates, navigateToTimeline } = useTimelineDates()
  const entry = dates.get(eventType)
  const displayLabel = label ?? STANDARD_DATE_LABELS[eventType as StandardDateType] ?? eventType
  const dateValue = entry?.date ?? null
  const isUrgent = entry?.isHighlighted ?? false

  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
      isUrgent ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'
    }`}>
      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-500 text-xs">{displayLabel}:</span>
      <span className={`font-medium ${dateValue ? 'text-slate-900' : 'text-slate-400 italic'}`}>
        {formatDateDisplay(dateValue)}
      </span>
      <button
        type="button"
        onClick={() => navigateToTimeline(eventType)}
        className="ml-1 inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        aria-label={`Edit ${displayLabel} in Timeline tab`}
      >
        Edit in Timeline
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}
