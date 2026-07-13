/**
 * content-type.ts — First-class content classification (ADR-014)
 * Below Pillar, above entity_type. Drives URL patterns and SEO defaults.
 * Content Type is DECOUPLED from lifecycle stages / timeline.
 */

export interface ContentType {
  id: string
  pillarId: string
  slug: string
  label: string
  /** URL template, e.g. '/{pillar}/{slug}' */
  urlPattern: string
  defaultSchemaOrgType: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ContentTypeInput {
  pillarId: string
  slug: string
  label: string
  urlPattern: string
  defaultSchemaOrgType?: string
  isActive?: boolean
  displayOrder?: number
}
