/**
 * queryKeys.ts — Stable TanStack Query key factory for all ELMS cache namespaces.
 * Using a factory prevents string typos and makes cache invalidation type-safe.
 */

export interface EntityListOpts {
  pillar?: string
  workflowStatus?: string
  entityType?: string
  isFeatured?: boolean
  categoryId?: string
  search?: string
  tags?: string[]
  cursor?: string
  limit?: number
}

export const entityKeys = {
  all:       ()                         => ['entities'] as const,
  lists:     ()                         => ['entities', 'list'] as const,
  list:      (opts: EntityListOpts)     => ['entities', 'list', opts] as const,
  details:   ()                         => ['entities', 'detail'] as const,
  detail:    (id: string)               => ['entities', 'detail', id] as const,
  modules:   (id: string)               => ['entities', 'detail', id, 'modules'] as const,
  module:    (moduleId: string)         => ['modules', 'detail', moduleId] as const,
  blocks:    (moduleId: string)         => ['modules', 'detail', moduleId, 'blocks'] as const,
  timeline:  (id: string)               => ['entities', 'detail', id, 'timeline'] as const,
  seo:       (id: string)               => ['entities', 'detail', id, 'seo'] as const,
  overview:  (id: string)               => ['entities', 'detail', id, 'overview'] as const,
  eligibility: (id: string)             => ['entities', 'detail', id, 'eligibility'] as const,
  vacancies: (id: string)               => ['entities', 'detail', id, 'vacancies'] as const,
  fee:       (id: string)               => ['entities', 'detail', id, 'fee'] as const,
  pattern:   (id: string)               => ['entities', 'detail', id, 'pattern'] as const,
  selection: (id: string)               => ['entities', 'detail', id, 'selection'] as const,
  syllabus:  (id: string)               => ['entities', 'detail', id, 'syllabus'] as const,
  downloads: (id: string)               => ['entities', 'detail', id, 'downloads'] as const,
  links:     (id: string)               => ['entities', 'detail', id, 'links'] as const,
  media:     (id: string)               => ['entities', 'detail', id, 'media'] as const,
  revisions: (id: string)               => ['entities', 'detail', id, 'revisions'] as const,
  activity:  (id: string)               => ['entities', 'detail', id, 'activity'] as const,
  brokenLinks: (id: string)             => ['entities', 'detail', id, 'broken-links'] as const,
} as const

export const mediaKeys = {
  all:    ()                            => ['media'] as const,
  lists:  ()                            => ['media', 'list'] as const,
  list:   (opts: { folder?: string; search?: string; cursor?: string }) => ['media', 'list', opts] as const,
  detail: (id: string)                  => ['media', 'detail', id] as const,
} as const

export const categoryKeys = {
  all:    ()                            => ['categories'] as const,
  byPillar: (pillar: string)            => ['categories', 'pillar', pillar] as const,
} as const

// ── M3.8 / M3.9 additions ─────────────────────────────────────────────────────

export const pillarKeys = {
  all:    () => ['pillars'] as const,
  list:   () => ['pillars', 'list'] as const,
  detail: (id: string) => ['pillars', 'detail', id] as const,
} as const

export const templateKeys = {
  all:      ()                    => ['templates'] as const,
  list:     (pillarId?: string)   => ['templates', 'list', pillarId ?? 'all'] as const,
  detail:   (id: string)          => ['templates', 'detail', id] as const,
  versions: (templateId: string)  => ['templates', 'versions', templateId] as const,
} as const

export const contentTypeKeys = {
  all:    ()                  => ['content-types'] as const,
  list:   (pillarId?: string) => ['content-types', 'list', pillarId ?? 'all'] as const,
  detail: (id: string)        => ['content-types', 'detail', id] as const,
} as const

export const relationshipKeys = {
  all:  ()                     => ['relationships'] as const,
  list: (entityId: string)     => ['relationships', 'list', entityId] as const,
} as const

export const amendmentKeys = {
  all:       ()                => ['amendments'] as const,
  list:      (entityId: string)=> ['amendments', 'list', entityId] as const,
  published: (entityId: string)=> ['amendments', 'published', entityId] as const,
} as const

export const localizationKeys = {
  all:    ()                                => ['localizations'] as const,
  entity: (entityId: string, lang: string) => ['localizations', entityId, lang] as const,
} as const

export const slugHistoryKeys = {
  list: (entityId: string) => ['slug-history', entityId] as const,
} as const

export const taxonomyKeys = {
  all:    ()                            => ['taxonomy'] as const,
  list:   (table: string)               => ['taxonomy', table, 'list'] as const,
  detail: (table: string, id: string)   => ['taxonomy', table, 'detail', id] as const,
} as const

export const healthKeys = {
  entity: (entityId: string) => ['health', entityId] as const,
} as const
