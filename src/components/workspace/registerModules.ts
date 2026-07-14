/**
 * registerModules.ts — Registers all workspace modules in the MODULE_REGISTRY.
 *
 * Called once at app initialization. Each module registers its editor (lazy-loaded)
 * and optional inspector. Adding a new module = one call to registerModule here.
 *
 * Phase 2: All editors point to PlaceholderEditor.
 * Phase 3: Each editor will be replaced with its real implementation.
 */
import { registerModule, type WorkspaceModuleKey, type ModuleGroup } from './registry'

// ── Module definitions ────────────────────────────────────────────────────────

interface ModuleSeed {
  key: WorkspaceModuleKey
  label: string
  icon: string
  group: ModuleGroup
  defaultOrder: number
  permission: string | null
  hasHealthWidget: boolean
}

const MODULE_SEEDS: ModuleSeed[] = [
  // Identity
  { key: 'general',           label: 'General',           icon: 'FileText',       group: 'identity',   defaultOrder: 1,  permission: null,                     hasHealthWidget: false },
  { key: 'overview',          label: 'Overview',          icon: 'BookOpen',       group: 'identity',   defaultOrder: 2,  permission: null,                     hasHealthWidget: false },

  // Structured data
  { key: 'timeline',          label: 'Timeline',          icon: 'Calendar',       group: 'structured', defaultOrder: 3,  permission: null,                     hasHealthWidget: true },
  { key: 'eligibility',       label: 'Eligibility',       icon: 'UserCheck',      group: 'structured', defaultOrder: 4,  permission: null,                     hasHealthWidget: false },
  { key: 'vacancy',           label: 'Vacancy',           icon: 'Users',          group: 'structured', defaultOrder: 5,  permission: null,                     hasHealthWidget: false },
  { key: 'fee',               label: 'Fees',              icon: 'IndianRupee',    group: 'structured', defaultOrder: 6,  permission: null,                     hasHealthWidget: false },
  { key: 'exam_pattern',      label: 'Exam Pattern',      icon: 'ClipboardList',  group: 'structured', defaultOrder: 7,  permission: null,                     hasHealthWidget: false },
  { key: 'selection_process', label: 'Selection Process', icon: 'GitBranch',      group: 'structured', defaultOrder: 8,  permission: null,                     hasHealthWidget: false },
  { key: 'syllabus',          label: 'Syllabus',          icon: 'Book',           group: 'structured', defaultOrder: 9,  permission: null,                     hasHealthWidget: false },

  // Content
  { key: 'modules',           label: 'Content',           icon: 'Layers',         group: 'content',    defaultOrder: 10, permission: null,                     hasHealthWidget: false },

  // Assets
  { key: 'downloads',         label: 'Downloads',         icon: 'Download',       group: 'assets',     defaultOrder: 11, permission: null,                     hasHealthWidget: false },
  { key: 'links',             label: 'Official Links',    icon: 'ExternalLink',   group: 'assets',     defaultOrder: 12, permission: null,                     hasHealthWidget: true },
  { key: 'media',             label: 'Media',             icon: 'Image',          group: 'assets',     defaultOrder: 13, permission: 'manage_entity_media',    hasHealthWidget: false },

  // Workflow
  { key: 'seo',               label: 'SEO',               icon: 'Search',         group: 'workflow',   defaultOrder: 14, permission: 'manage_entity_seo',      hasHealthWidget: true },
  { key: 'relationships',     label: 'Relationships',     icon: 'Link2',          group: 'workflow',   defaultOrder: 15, permission: 'manage_relationships',   hasHealthWidget: false },
  { key: 'amendments',        label: 'Amendments',        icon: 'FileEdit',       group: 'workflow',   defaultOrder: 16, permission: null,                     hasHealthWidget: false },
  { key: 'verification',      label: 'Verification',      icon: 'ShieldCheck',    group: 'workflow',   defaultOrder: 17, permission: 'verify_content',         hasHealthWidget: true },
  { key: 'publishing',        label: 'Publishing',        icon: 'Rocket',         group: 'workflow',   defaultOrder: 18, permission: null,                     hasHealthWidget: true },
  { key: 'health',            label: 'Health',            icon: 'Activity',       group: 'workflow',   defaultOrder: 19, permission: null,                     hasHealthWidget: true },
]

// ── Editor loaders (lazy imports — each editor is a separate code chunk) ──────

const EDITOR_LOADERS: Record<string, () => Promise<{ default: React.ComponentType<{ entityId: string }> }>> = {
  general:           () => import('./editors/GeneralEditor'),
  overview:          () => import('./editors/OverviewEditor'),
  timeline:          () => import('./editors/TimelineEditor'),
  eligibility:       () => import('./editors/EligibilityEditor'),
  vacancy:           () => import('./editors/VacancyEditor'),
  fee:               () => import('./editors/FeeEditor'),
  exam_pattern:      () => import('./editors/ExamPatternEditor'),
  selection_process: () => import('./editors/SelectionProcessEditor'),
  syllabus:          () => import('./editors/SyllabusEditor'),
  modules:           () => import('./editors/ModulesEditor'),
  downloads:         () => import('./editors/DownloadsEditor'),
  links:             () => import('./editors/LinksEditor'),
  media:             () => import('./editors/MediaEditor'),
  seo:               () => import('./editors/SEOEditor'),
  relationships:     () => import('./editors/RelationshipsEditor'),
  amendments:        () => import('./editors/AmendmentsEditor'),
  publishing:        () => import('./editors/PublishingEditor'),
  health:            () => import('./editors/HealthEditor'),
  verification:      () => import('./editors/VerificationEditor'),
}

// Fallback for any module not in the map (should never happen with correct seeds)
const fallbackLoader = () => import('./PlaceholderEditor')

// ── Register all modules ──────────────────────────────────────────────────────

import type React from 'react'

export function initializeModuleRegistry(): void {
  for (const seed of MODULE_SEEDS) {
    registerModule({
      ...seed,
      editor: EDITOR_LOADERS[seed.key] ?? fallbackLoader,
      inspector: null,
    })
  }
}
