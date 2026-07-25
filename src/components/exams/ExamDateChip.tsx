/**
 * ExamDateChip — read-only display of a standard exam date.
 *
 * Ported from the ELMS `ReadOnlyDateChip` pattern (Track 2, Option B). Reads the
 * canonical value out of the form's `dates` array (`exams.important_dates`) and
 * offers a jump to the one editable surface.
 *
 * Rendered wherever a standard date used to have its own input, so the same date
 * can never be edited in two places.
 */
import React from 'react'
import { Calendar, ArrowRight, Lock } from 'lucide-react'
import {
  EXAM_STANDARD_DATE_LABELS,
  findStandardDate,
  formatExamDate,
  type ExamDateEntry,
  type ExamStandardDateType,
} from '@/lib/exams/standardDates'

interface ExamDateChipProps {
  type: ExamStandardDateType
  /** Current value of the form's `dates` array. */
  dates: ExamDateEntry[] | undefined
  /** Jump to the Important Dates editor. Omit to render without the link. */
  onEdit?: () => void
  /** Overrides the standard label (e.g. to keep a profile-specific wording). */
  label?: string
}

export function ExamDateChip({ type, dates, onEdit, label }: ExamDateChipProps) {
  const entry = findStandardDate(dates, type)
  const value = entry?.date ?? null
  const isUrgent = entry?.isUrgent ?? false
  const displayLabel = label ?? EXAM_STANDARD_DATE_LABELS[type]

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
        {displayLabel}
        <Lock size={11} className="text-slate-400" aria-hidden="true" />
      </label>
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          isUrgent ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className={value ? 'font-medium text-slate-900' : 'italic text-slate-400'}>
          {formatExamDate(value)}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-0.5 text-xs text-blue-600 transition-colors hover:text-blue-800"
            aria-label={`Edit ${displayLabel} in Important Dates`}
          >
            Edit in Important Dates
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-400">
        Set once in Important Dates — shown here for reference.
      </p>
    </div>
  )
}
