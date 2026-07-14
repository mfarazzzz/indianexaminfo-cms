/**
 * ModulesEditor.tsx — Block-based content modules CRUD. REQ-012.
 * Delegates to the existing ModulesTab which handles module create/reorder/delete/duplicate
 * and the nested ModuleEditor with block editing.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const ModulesTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/ModulesTab').then(m => ({ default: m.ModulesTab }))
)

export default function ModulesEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-64 bg-slate-100 rounded" /></div>}>
      <ModulesTab entityId={entityId} />
    </React.Suspense>
  )
}
