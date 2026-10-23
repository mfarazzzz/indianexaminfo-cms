/**
 * EvergreenNameHint — a SOFT, non-blocking advisory under the exam-name field.
 *
 * Shown whenever the current name ends with a 20YY year (see lib/exams/
 * evergreenName). It only tells the editor "put the year in the edition, not the
 * name" — it never blocks Save/Create and never changes the value. The December
 * batch migration is the enforcement; this is the nudge at the moment of typing,
 * for both new exams (Create Exam) and edits (Save Changes), since GeneralTab is
 * the single identity surface for both.
 */
import React from 'react'
import { Info } from 'lucide-react'
import { nameEndsWithYear } from '@/lib/exams/evergreenName'

export function EvergreenNameHint({ name }: { name: string | null | undefined }) {
  if (!nameEndsWithYear(name)) return null
  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600" role="note">
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
      Put the year in the edition, not the name.
    </p>
  )
}
