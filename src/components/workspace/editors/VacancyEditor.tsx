/**
 * VacancyEditor.tsx — Structured vacancy table editor. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const VacancyTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/VacancyTab').then(m => ({ default: m.VacancyTab }))
)

export default function VacancyEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <VacancyTab entityId={entityId} />
    </React.Suspense>
  )
}
