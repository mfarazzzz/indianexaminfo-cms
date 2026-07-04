import { db } from '@/lib/supabase/client'
import type { EntitySeo } from '@/types/entity'
import type { SEOInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntitySeo {
  return {
    id: r.id as string, entityId: r.entity_id as string,
    seoTitle: r.seo_title as string | null,
    metaDescription: r.meta_description as string | null,
    focusKeywords: (r.focus_keywords as string[]) ?? [],
    canonicalUrl: r.canonical_url as string | null,
    robots: (r.robots as string) ?? 'index',
    ogTitle: r.og_title as string | null,
    ogDescription: r.og_description as string | null,
    ogImage: r.og_image as string | null,
    twitterCard: (r.twitter_card as string) ?? 'summary_large_image',
    twitterTitle: r.twitter_title as string | null,
    twitterDescription: r.twitter_description as string | null,
    twitterImage: r.twitter_image as string | null,
    faqSchema: r.faq_schema as Record<string, unknown> | null,
    breadcrumbSchema: r.breadcrumb_schema as Record<string, unknown> | null,
    customJsonLd: r.custom_json_ld as string | null,
    seoScore: r.seo_score as number | null,
    updatedAt: r.updated_at as string,
    updatedBy: r.updated_by as string | null,
  }
}

export async function getSeo(entityId: string): Promise<EntitySeo | null> {
  const { data, error } = await db
    .from('entity_seo').select('*').eq('entity_id', entityId).maybeSingle()
  if (error) throw error
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function upsertSeo(
  entityId: string, input: SEOInput
): Promise<EntitySeo> {
  const score = calcSeoScore(input)
  const { data, error } = await db
    .from('entity_seo')
    .upsert({
      entity_id: entityId,
      seo_title: input.seoTitle ?? null,
      meta_description: input.metaDescription ?? null,
      focus_keywords: input.focusKeywords ?? [],
      canonical_url: input.canonicalUrl ?? null,
      robots: input.robots ?? 'index',
      og_title: input.ogTitle ?? null,
      og_description: input.ogDescription ?? null,
      og_image: input.ogImage ?? null,
      twitter_card: input.twitterCard ?? 'summary_large_image',
      twitter_title: input.twitterTitle ?? null,
      twitter_description: input.twitterDescription ?? null,
      twitter_image: input.twitterImage ?? null,
      custom_json_ld: input.customJsonLd ?? null,
      seo_score: score,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id' })
    .select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/** SEO completeness score 0–100 per R16.4 */
export function calcSeoScore(seo: Partial<SEOInput> & { faqSchema?: unknown }): number {
  let score = 0
  if (seo.seoTitle && seo.seoTitle.length > 0 && seo.seoTitle.length <= 60)    score += 25
  else if (seo.seoTitle && seo.seoTitle.length > 0)                             score += 10
  if (seo.metaDescription && seo.metaDescription.length > 0 && seo.metaDescription.length <= 160) score += 25
  else if (seo.metaDescription && seo.metaDescription.length > 0)               score += 10
  if ((seo.focusKeywords ?? []).length > 0)  score += 15
  if (seo.ogImage)                           score += 15
  if (seo.faqSchema)                         score += 10
  if (seo.canonicalUrl)                      score += 10
  return Math.min(score, 100)
}
