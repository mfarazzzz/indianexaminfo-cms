/**
 * ExamEditorPage.tsx — Legacy /exams/:id route.
 * Now renders the same WorkspaceShell as EntityEditorPage.
 * Kept for backward compatibility with bookmarks.
 */
import { useParams } from 'react-router-dom'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

export function ExamEditorPage() {
  const { id } = useParams<{ id?: string }>()
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
