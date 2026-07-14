/**
 * GeneralEditor.tsx — Dynamic field editor driven by templateSnapshot.fieldDefinitions.
 *
 * This editor renders form fields exclusively from the entity's template configuration.
 * No hardcoded field lists. Uses existing GeneralTab as the implementation since
 * it already reads from templateSnapshot and supports autosave.
 *
 * REQ-003: Dynamic Field Definitions (ADR-003)
 */
import React from 'react'
import type { EditorProps } from '../registry'
import { GeneralTab } from '@/components/entity-editor/tabs/GeneralTab'

export default function GeneralEditor({ entityId }: EditorProps) {
  return <GeneralTab entityId={entityId} />
}
