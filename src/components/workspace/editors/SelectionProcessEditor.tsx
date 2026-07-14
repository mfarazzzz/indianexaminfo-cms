/**
 * SelectionProcessEditor.tsx — Selection process stages editor. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const SelectionProcessTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/SelectionProcessTab').then(m => ({ default: m.SelectionProcessTab }))
)

export default function SelectionProcessEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <SelectionProcessTab entityId={entityId} />
    </React.Suspense>
  )
}
