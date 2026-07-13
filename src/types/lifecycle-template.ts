/**
 * lifecycle-template.ts — Structural taxonomy: template configuration
 * Templates define: field definitions, feature flags, module visibility,
 * timeline stages, lifecycle rules, layout, and schema.org type.
 * Entities reference an immutable snapshot of the version at creation (ADR-005).
 */

// ── Feature Flags ─────────────────────────────────────────────────────────────

/**
 * Feature flags are typed boolean properties in TemplateConfiguration.
 * They are the INPUT that generates moduleVisibility (the OUTPUT) at version
 * creation time. Flags are never read at entity runtime — only moduleVisibility is.
 */
export interface FeatureFlags {
  supports_syllabus: boolean
  supports_answer_key: boolean
  supports_cutoff: boolean
  supports_books: boolean
  supports_counselling: boolean
  supports_mock_test: boolean
  supports_previous_papers: boolean
  supports_admit_card: boolean
  supports_result: boolean
  supports_downloads: boolean
  supports_links: boolean
  supports_exam_pattern: boolean
  supports_selection_process: boolean
  supports_vacancy: boolean
  supports_fee: boolean
  supports_eligibility: boolean
}

// ── Field Definitions ─────────────────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean' | 'url'

/**
 * A FieldDefinition drives what GeneralTab renders for this template.
 * Fields with storeIn:'column' save to typed entity columns.
 * Fields with storeIn:'metadata' save to entity.metadata JSONB.
 */
export interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  /** For type='select': 'taxonomy:conducting_body' OR undefined to use options[] */
  source?: string
  /** For type='select' with inline options */
  options?: { label: string; value: string }[]
  required: boolean
  placeholder?: string
  helpText?: string
  group: string
  displayOrder: number
  storeIn: 'column' | 'metadata'
  validationRules?: Record<string, unknown>
}

// ── Timeline Stage Definitions ────────────────────────────────────────────────

/**
 * Stage definitions live in template_snapshot.defaultTimelineStages.
 * Instances (actual dates) live in entity_timeline_event table.
 */
export interface TimelineStageDefinition {
  stageKey: string
  label: string
  isRequired: boolean
  /** stageKeys that must have event_date set before this stage can have a date */
  dependsOn: string[]
  /** Optional event subtypes within this stage, e.g. ['application_open','application_close'] */
  eventSubtypes?: string[]
}

// ── Lifecycle Rules ───────────────────────────────────────────────────────────

export interface LifecycleRule {
  ruleType: 'must_follow' | 'cannot_precede' | 'requires'
  subjectStage: string
  objectStage: string
  errorMessage: string
}

// ── Module Visibility ─────────────────────────────────────────────────────────

export interface ModuleVisibilityConfig {
  enabled: boolean
  required: boolean
  displayOrder: number
}

export type ModuleVisibilityMap = Record<string, ModuleVisibilityConfig>

// ── Template Configuration ────────────────────────────────────────────────────

/**
 * The full configuration blob stored in lifecycle_template_version.configuration
 * and copied into entity.template_snapshot at creation.
 * After creation, entity.template_snapshot is IMMUTABLE (ADR-005).
 */
export interface TemplateConfiguration {
  defaultModules: string[]
  defaultTimelineStages: TimelineStageDefinition[]
  defaultValidationRules: Record<string, unknown>
  defaultSchemaOrgType: string
  lifecycleRules: LifecycleRule[]
  moduleVisibility: ModuleVisibilityMap
  /** Drives frontend layout registry lookup (ADR-015) */
  frontendLayout: string
  /** Input that generated moduleVisibility — not used at entity runtime */
  featureFlags: FeatureFlags
  /** Dynamic field definitions for GeneralTab (ADR-003) */
  fieldDefinitions: FieldDefinition[]
}

// ── Lifecycle Template ────────────────────────────────────────────────────────

export interface LifecycleTemplate {
  id: string
  pillarId: string
  name: string
  slug: string
  description?: string | null
  defaultModules: string[]
  defaultTimelineStages: TimelineStageDefinition[]
  defaultValidationRules: Record<string, unknown>
  defaultSchemaOrgType: string
  lifecycleRules: LifecycleRule[]
  frontendLayout: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface LifecycleTemplateVersion {
  id: string
  templateId: string
  versionNumber: number
  /** IMMUTABLE after INSERT — never updated */
  configuration: TemplateConfiguration
  changeSummary?: string | null
  isActive: boolean
  createdBy?: string | null
  createdAt: string
}

export interface TemplateInput {
  pillarId: string
  name: string
  slug: string
  description?: string
  defaultModules?: string[]
  defaultTimelineStages?: TimelineStageDefinition[]
  defaultSchemaOrgType?: string
  lifecycleRules?: LifecycleRule[]
  frontendLayout?: string
  isActive?: boolean
  displayOrder?: number
}
