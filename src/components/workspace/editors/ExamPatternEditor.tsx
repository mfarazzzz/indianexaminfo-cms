/**
 * ExamPatternEditor.tsx — Exam pattern builder. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const ExamPatternTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/ExamPatternTab').then(m => ({ default: m.ExamPatternTab }))
)

export default function ExamPatternEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <ExamPatternTab entityId={entityId} />
    </React.Suspense>
  )
}
