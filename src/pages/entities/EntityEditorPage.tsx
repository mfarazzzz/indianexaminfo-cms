/**
 * EntityEditorPage.tsx — Renders the new Workspace for a specific entity.
 *
 * M4 Integration: Replaces the old EntityEditorShell with WorkspaceProvider + WorkspaceShell.
 * The workspace is registry-driven — no hardcoded tabs or modules.
 *
 * Provider chain note:
 * The tab components under `components/entity-editor/tabs/` are reused as workspace
 * editors (see `components/workspace/editors/`). Several of them call `useEditorUI()`,
 * `usePillarContext()`, and `useTimelineDates()`, which were previously supplied by the
 * now-retired `EntityEditorShell`. When the workspace replaced that shell, the providers
 * were not carried over, so any editor calling `useEditorUI()` threw on mount and the
 * route rendered the router's error fallback. The providers are mounted here so the
 * reused editors keep working.
 *
 * Order matters: TimelineDatesProvider calls useEditorUI(), so it must sit inside
 * EditorUIProvider.
 */
import { useParams } from 'react-router-dom'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { usePillars } from '@/hooks/usePillars'
import { EditorUIProvider } from '@/contexts/EditorUIContext'
import { PillarProvider } from '@/contexts/PillarContext'
import { TimelineDatesProvider } from '@/contexts/TimelineDatesContext'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

export function EntityEditorPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id ?? ''

  const { data: entity, isLoading, isError } = useEntityQuery(entityId || null)
  const { data: pillars = [] } = usePillars()

  return (
    <PillarProvider pillars={pillars}>
      <EditorUIProvider defaultTab="general">
        <TimelineDatesProvider entityId={entityId}>
          <WorkspaceProvider
            entityId={entityId}
            entity={entity ?? null}
            isLoading={isLoading}
            isError={isError}
          >
            <WorkspaceShell />
          </WorkspaceProvider>
        </TimelineDatesProvider>
      </EditorUIProvider>
    </PillarProvider>
  )
}
