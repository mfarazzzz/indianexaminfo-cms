/**
 * entity-amendment.ts — Structured corrigendum / correction records
 * Amendments are public-facing: readers see "Updated On / What's Changed".
 * They do NOT replace the entity fields — both the amendment and updated fields coexist.
 */

export type AmendmentWorkflowStatus = 'draft' | 'published' | 'archived'

export interface EntityAmendment {
  id: string
  entityId: string
  title: string
  description?: string | null
  /** Names of entity fields that were changed, e.g. ['event_date', 'vacancy'] */
  changedFields: string[]
  changeSummary: string
  effectiveDate: string  // ISO date string e.g. '2026-01-15'
  publishedDate?: string | null
  workflowStatus: AmendmentWorkflowStatus
  displayOrder: number
  createdAt: string
  createdBy?: string | null
  updatedAt: string
  updatedBy?: string | null
  deletedAt?: string | null
}

export interface AmendmentInput {
  entityId: string
  title: string
  description?: string
  changedFields?: string[]
  changeSummary: string
  effectiveDate: string
  displayOrder?: number
}
