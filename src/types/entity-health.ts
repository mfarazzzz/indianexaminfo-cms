/**
 * entity-health.ts — Computed content quality model (ADR-010)
 * NOT stored in the database — computed on demand by healthService.
 * Feeds: entity list health indicator, editor header badge, publish gate.
 */

export type VerificationStatus = 'verified' | 'unverified' | 'overdue'

export interface EntityHealth {
  entityId: string
  /** 0–100: percentage of non-null required fields filled */
  completenessScore: number
  /** 0–100: SEO best practices (title, description, og_image, schema) */
  seoScore: number
  verificationStatus: VerificationStatus
  lastVerifiedAt?: string | null
  /** Count of entity_link rows with broken URL status */
  brokenLinkCount: number
  /** Module types with required:true in snapshot but zero published blocks */
  missingRequiredModules: string[]
  /** True if entity has at least one amendment with workflow_status='published' */
  hasPublishedAmendment: boolean
  /** lang → percentage of translatable fields translated (0–100) */
  translationCoverage: Record<string, number>
  /** Blocking issues that prevent publish transition (empty = ready to publish) */
  publishReadiness: string[]
}

/** Simplified health indicator for list views */
export type HealthColor = 'green' | 'yellow' | 'red'

export function getHealthColor(health: EntityHealth): HealthColor {
  const score = (health.completenessScore + health.seoScore) / 2
  if (health.publishReadiness.length > 0 || score < 40) return 'red'
  if (score < 70 || health.verificationStatus === 'overdue') return 'yellow'
  return 'green'
}
