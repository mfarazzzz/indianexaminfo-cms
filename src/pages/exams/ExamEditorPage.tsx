import { useParams } from 'react-router-dom'
import { EntityEditorShell } from '@/components/entity-editor/EntityEditorShell'
import { EditorUIProvider } from '@/contexts/EditorUIContext'

export function ExamEditorPage() {
  const { id } = useParams<{ id?: string }>()
  return (
    <EditorUIProvider defaultTab="general">
      <EntityEditorShell entityId={id ?? null} />
    </EditorUIProvider>
  )
}
