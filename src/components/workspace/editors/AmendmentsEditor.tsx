/**
 * AmendmentsEditor.tsx — Amendment/correction records editor. REQ-018.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const AmendmentsSection = React.lazy(() =>
  import('@/components/entity-editor/tabs/AmendmentsSection').then(m => ({ default: m.AmendmentsSection }))
)

export default function AmendmentsEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <AmendmentsSection entityId={entityId} />
    </React.Suspense>
  )
}
