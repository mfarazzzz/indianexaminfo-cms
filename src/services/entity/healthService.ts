/**
 * healthService.ts — Computed entity health model (ADR-010).
 * NOT stored in the database — computed on demand.
 * Results are cached client-side by useEntityHealth hook (2-min TTL).
 */
import { db } from '@/lib/supabase/client'
import type { EntityHealth, VerificationStatus } from '@/types/entity-health'
import type { TemplateConfiguration, ModuleVisibilityMap } from '@/types/lifecycle-template'

const VERIFICATION_OVERDUE_DAYS = 90

// ── Internal helpers ──────────────────────────────────────────────────────────

function verificationStatus(lastVerifiedAt: string | null): VerificationStatus {
  if (!lastVerifiedAt) return 'unverified'
  const diffDays = (Date.now() - new Date(lastVerifiedAt).getTime()) / 86_400_000
  return diffDays > VERIFICATION_OVERDUE_DAYS ? 'overdue' : 'verified'
}

function scoreSeo(seo: Record<string, unknown> | null): number {
  if (!seo) return 0
  let score = 0
  const title = seo.seo_title as string | null
  const desc  = seo.meta_description as string | null
  const og    = seo.og_image as string | null
  const kw    = seo.focus_keywords as string[] | null

  if (title && title.length >= 30 && title.length <= 70) score += 30
  else if (title) score += 15

  if (desc && desc.length >= 120 && desc.length <= 160) score += 30
  else if (desc) score += 15

  if (og) score += 20
  if (kw && kw.length > 0) score += 20

  return Math.min(score, 100)
}

function scoreCompleteness(
  entity: Record<string, unknown>,
  seo: Record<string, unknown> | null
): number {
  const checks = [
    !!entity.name,
    !!entity.pillar,
    !!entity.content_type_id,
    !!entity.template_version_id,
    !!(entity.conducting_body_id || (entity.metadata as Record<string, unknown>)?.author_name),
    !!seo?.seo_title,
    !!seo?.meta_description,
    !!seo?.og_image,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function missingRequiredModules(
  moduleVisibility: ModuleVisibilityMap,
  moduleBlockCounts: Map<string, number>
): string[] {
  return Object.entries(moduleVisibility)
    .filter(([, cfg]) => cfg.required && cfg.enabled)
    .filter(([moduleType]) => (moduleBlockCounts.get(moduleType) ?? 0) === 0)
    .map(([moduleType]) => moduleType)
}

function buildPublishReadiness(
  seo: Record<string, unknown> | null,
  missing: string[],
  workflowStatus: string
): string[] {
  const issues: string[] = []

  if (!seo?.seo_title || (seo.seo_title as string).trim() === '') {
    issues.push('SEO title is missing')
  }
  if (!seo?.meta_description || (seo.meta_description as string).trim() === '') {
    issues.push('Meta description is missing')
  }
  const descLen = (seo?.meta_description as string)?.length ?? 0
  if (descLen > 0 && (descLen < 120 || descLen > 160)) {
    issues.push(`Meta description should be 120–160 characters (currently ${descLen})`)
  }
  if (missing.length > 0) {
    issues.push(`Required modules are empty: ${missing.join(', ')}`)
  }
  if (workflowStatus === 'draft') {
    issues.push('Entity must be in Review status before publishing')
  }

  return issues
}

function translationCoverage(
  locRows: { lang: string; field_key: string }[],
  totalFields = 8 // approximate translatable fields
): Record<string, number> {
  const byLang: Record<string, number> = {}
  for (const row of locRows) {
    byLang[row.lang] = (byLang[row.lang] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(byLang).map(([lang, count]) => [
      lang,
      Math.min(Math.round((count / totalFields) * 100), 100),
    ])
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function computeEntityHealth(entityId: string): Promise<EntityHealth> {
  // Run all queries in parallel
  const [
    entityResult,
    seoResult,
    modulesResult,
    linksResult,
    amendmentsResult,
    locResult,
  ] = await Promise.all([
    db.from('entity').select('*').eq('id', entityId).single(),
    db.from('entity_seo').select('*').eq('entity_id', entityId).single(),
    db.from('entity_module')
      .select('id, module_type, entity_module_block(id)')
      .eq('entity_id', entityId)
      .is('deleted_at', null),
    db.from('entity_link')
      .select('id, status')
      .eq('entity_id', entityId)
      .is('deleted_at', null),
    db.from('entity_amendment')
      .select('id')
      .eq('entity_id', entityId)
      .eq('workflow_status', 'published')
      .is('deleted_at', null),
    db.from('entity_localization')
      .select('lang, field_key')
      .eq('entity_id', entityId),
  ])

  const entity = entityResult.data as Record<string, unknown> | null
  if (!entity) throw new Error(`Entity ${entityId} not found`)

  const seo = seoResult.data as Record<string, unknown> | null
  const modules = (modulesResult.data ?? []) as Array<{ module_type: string; entity_module_block: Array<{ id: string }> }>
  const links = (linksResult.data ?? []) as Array<{ status: string }>
  const publishedAmendments = (amendmentsResult.data ?? [])
  const locRows = (locResult.data ?? []) as { lang: string; field_key: string }[]

  // Module block counts per module_type
  const moduleBlockCounts = new Map<string, number>()
  for (const mod of modules) {
    const current = moduleBlockCounts.get(mod.module_type) ?? 0
    moduleBlockCounts.set(mod.module_type, current + (mod.entity_module_block?.length ?? 0))
  }

  const snapshot = entity.template_snapshot as { moduleVisibility?: ModuleVisibilityMap } | null
  const moduleVisibility = snapshot?.moduleVisibility ?? {}

  const missing = missingRequiredModules(moduleVisibility, moduleBlockCounts)
  const seoScore = scoreSeo(seo)
  const completenessScore = scoreCompleteness(entity, seo)
  const broken = links.filter(l => l.status === 'inactive').length
  const hasPublishedAmendment = publishedAmendments.length > 0
  const coverage = translationCoverage(locRows)
  const vStatus = verificationStatus(entity.last_verified_at as string | null)
  const publishReady = buildPublishReadiness(seo, missing, entity.workflow_status as string)

  return {
    entityId,
    completenessScore,
    seoScore,
    verificationStatus: vStatus,
    lastVerifiedAt: entity.last_verified_at as string | null,
    brokenLinkCount: broken,
    missingRequiredModules: missing,
    hasPublishedAmendment,
    translationCoverage: coverage,
    publishReadiness: publishReady,
  }
}

/** Convenience function used by PublishingTab publish gate */
export async function getPublishReadiness(entityId: string): Promise<string[]> {
  const health = await computeEntityHealth(entityId)
  return health.publishReadiness
}
