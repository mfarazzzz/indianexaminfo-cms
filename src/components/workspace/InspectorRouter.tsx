/**
 * InspectorRouter.tsx — Resolves inspector from INSPECTOR_REGISTRY.
 *
 * No switch statements. Reads InspectorDefinition from the registry for the
 * active module. Falls back to a default view when no inspector is registered.
 *
 * Updates automatically when activeModule changes (via WorkspaceNavContext).
 */
import React from 'react'
import { Info } from 'lucide-react'
import { useWorkspaceNav, useWorkspaceData } from './WorkspaceContext'
import { getInspector } from './inspectors/inspectorRegistry'
import { InspectorSection, InspectorMetric } from './inspectors/primitives'

// ── Default Inspector (unregistered modules) ──────────────────────────────────

function DefaultInspector({ entityId, moduleKey }: { entityId: string; moduleKey: string }) {
  return (
    <InspectorSection title="Module Info">
      <div className="flex items-center gap-2 text-slate-600 mb-2">
        <Info className="h-4 w-4" />
        <span className="text-sm font-medium capitalize">{moduleKey.replace(/_/g, ' ')}</span>
      </div>
      <InspectorMetric label="Entity" value={entityId.slice(0, 8) + '…'} />
      <p className="text-xs text-slate-400 mt-2">
        No inspector registered for this module.
      </p>
    </InspectorSection>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export function InspectorRouter() {
  const { activeModule } = useWorkspaceNav()
  const { entityId } = useWorkspaceData()

  // Resolve inspector from registry — NO switch statement
  const inspectorDef = getInspector(activeModule)

  if (!inspectorDef) {
    return <DefaultInspector entityId={entityId} moduleKey={activeModule} />
  }

  const InspectorComponent = inspectorDef.component

  return <InspectorComponent entityId={entityId} moduleKey={activeModule} />
}
