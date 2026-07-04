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
