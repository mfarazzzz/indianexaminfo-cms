/**
 * SyllabusEditor.tsx — Syllabus subjects editor. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const SyllabusTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/SyllabusTab').then(m => ({ default: m.SyllabusTab }))
)

export default function SyllabusEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <SyllabusTab entityId={entityId} />
    </React.Suspense>
  )
}
