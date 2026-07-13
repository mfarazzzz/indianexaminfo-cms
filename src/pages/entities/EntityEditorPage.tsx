/**
 * EntityEditorPage.tsx — Renders EntityEditorShell for a specific entity.
 * Reads :id param from URL.
 */
import { useParams } from 'react-router-dom'
import { EntityEditorShell } from '@/components/entity-editor/EntityEditorShell'

export function EntityEditorPage() {
  const { id } = useParams<{ id: string }>()
  return <EntityEditorShell entityId={id ?? null} />
}
