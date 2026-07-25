/**
 * ReadOnlyVacancyChip — Displays total vacancy from TimelineDatesContext as a non-editable chip.
 * Shows "Not set" when null, numeric value otherwise.
 * Includes "Edit in Vacancy →" navigation link. (Req 4.3, 4.5)
 */
import React from 'react'
import { Users, ArrowRight } from 'lucide-react'
import { useTimelineDates } from '@/contexts/TimelineDatesContext'

export function ReadOnlyVacancyChip() {
  const { totalVacancy, navigateToVacancy } = useTimelineDates()

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-500 text-xs">Total Vacancies:</span>
      <span className={`font-medium ${totalVacancy !== null ? 'text-slate-900' : 'text-slate-400 italic'}`}>
        {totalVacancy !== null ? totalVacancy.toLocaleString('en-IN') : 'Not set'}
      </span>
      <button
        type="button"
        onClick={navigateToVacancy}
        className="ml-1 inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        aria-label="Edit total vacancies in Vacancy tab"
      >
        Edit in Vacancy
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}
