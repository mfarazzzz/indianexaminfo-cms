/**
 * entity-slug-history.ts — Append-only slug redirect chain
 * Every slug change auto-creates a redirect entry.
 * Old slugs always 301 → current slug. No URL is ever lost.
 * Rows are NEVER deleted (append-only governance policy).
 */

export interface EntitySlugHistory {
  id: string
  entityId: string
  oldSlug: string
  newSlug: string
  pillarSlug: string
  redirectType: '301' | '302'
  createdAt: string
  createdBy?: string | null
}

export interface SlugResolution {
  resolved: boolean
  entityId?: string
  redirectType?: string
  /** Number of redirect hops followed (max 10) */
  hops?: number
  reason?: 'no_redirect_found' | 'max_hops_exceeded'
}
