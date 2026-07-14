/**
 * EligibilityEditor.tsx — Structured eligibility criteria editor.
 * Delegates to existing EligibilityTab. REQ-013.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const EligibilityTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/EligibilityTab').then(m => ({ default: m.EligibilityTab }))
)

export default function EligibilityEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <EligibilityTab entityId={entityId} />
    </React.Suspense>
  )
}
