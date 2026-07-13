/**
 * taxonomy.ts — Descriptive taxonomy types (editor-managed)
 * All 7 taxonomy tables share the same base schema.
 * Editors can create, rename, merge, and disable these terms.
 */

export interface TaxonomyBase {
  id: string
  slug: string
  label: string
  usageCount: number
  isActive: boolean
  /** 'taxonomy_manager' | 'inline_create' — for deduplication review reports */
  createdVia?: string | null
  createdAt: string
  createdBy?: string | null
  updatedAt: string
  deletedAt?: string | null
}

export interface ConductingBody extends TaxonomyBase {}
export interface Department extends TaxonomyBase {}
export interface Tag extends TaxonomyBase {}
export interface ExamLevel extends TaxonomyBase {}
export interface ExamMode extends TaxonomyBase {}
export interface ApplicationMode extends TaxonomyBase {}

/** The set of all taxonomy table names managed by taxonomyService */
export type TaxonomyTable =
  | 'conducting_body'
  | 'department'
  | 'tag'
  | 'exam_level'
  | 'exam_mode'
  | 'application_mode'
  | 'category'

export interface TaxonomyInput {
  label: string
  createdVia?: string
}

export interface MergeResult {
  sourceId: string
  targetId: string
  mergedCount: number
}
