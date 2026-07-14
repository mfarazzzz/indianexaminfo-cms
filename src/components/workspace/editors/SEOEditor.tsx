/**
 * SEOEditor.tsx — SEO metadata editor. REQ-015.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const SEOTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/SEOTab').then(m => ({ default: m.SEOTab }))
)

export default function SEOEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <SEOTab entityId={entityId} />
    </React.Suspense>
  )
}
