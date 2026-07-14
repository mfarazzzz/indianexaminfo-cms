/**
 * InspectorRouter.tsx — Resolves inspector component from MODULE_REGISTRY.
 *
 * No switch statements. Reads ModuleDefinition.inspector from the registry
 * for the currently active module. Falls back to DefaultInspector when
 * the module has no custom inspector registered.
 */
import React, { Suspense, lazy, useMemo } from 'react'
import { Loader2, Info } from 'lucide-react'
import { useWorkspaceNav, useWorkspaceData } from './WorkspaceContext'
import { getModule, type InspectorProps } from './registry'

// ── Default Inspector (used when module has no custom inspector) ───────────────

function DefaultInspector({ entityId, moduleKey }: InspectorProps) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-slate-600">
        <Info className="h-4 w-4" />
        <span className="text-sm font-medium capitalize">{moduleKey.replace(/_/g, ' ')}</span>
      </div>
      <p className="text-xs text-slate-400">
        Context-specific inspector details will appear here when available.
      </p>
      <div className="border-t pt-3 mt-3">
        <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-2">Quick Info</p>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-slate-400">Module</dt>
            <dd className="text-slate-600 capitalize">{moduleKey.replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Entity</dt>
            <dd className="text-slate-500 font-mono text-[10px]">{entityId.slice(0, 8)}…</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export function InspectorRouter() {
  const { activeModule } = useWorkspaceNav()
  const { entityId } = useWorkspaceData()

  const moduleDef = getModule(activeModule)

  // Resolve inspector from registry — no switch statement
  const InspectorComponent = useMemo(() => {
    if (!moduleDef?.inspector) return null
    return lazy(moduleDef.inspector)
  }, [moduleDef])

  if (!InspectorComponent) {
    return <DefaultInspector entityId={entityId} moduleKey={activeModule} />
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    }>
      <InspectorComponent entityId={entityId} moduleKey={activeModule} />
    </Suspense>
  )
}
