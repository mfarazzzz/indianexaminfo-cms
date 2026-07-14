/**
 * FeeEditor.tsx — Application fee structure editor. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const FeeTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/FeeTab').then(m => ({ default: m.FeeTab }))
)

export default function FeeEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <FeeTab entityId={entityId} />
    </React.Suspense>
  )
}
