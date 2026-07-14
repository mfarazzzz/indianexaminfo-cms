/**
 * EntityEditorPage.tsx — Renders the new Workspace for a specific entity.
 *
 * M4 Integration: Replaces the old EntityEditorShell with WorkspaceProvider + WorkspaceShell.
 * The workspace is registry-driven — no hardcoded tabs or modules.
 */
import { useParams } from 'react-router-dom'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

export function EntityEditorPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id ?? ''

  const { data: entity, isLoading, isError } = useEntityQuery(entityId || null)

  return (
    <WorkspaceProvider
      entityId={entityId}
      entity={entity ?? null}
      isLoading={isLoading}
      isError={isError}
    >
      <WorkspaceShell />
    </WorkspaceProvider>
  )
}
