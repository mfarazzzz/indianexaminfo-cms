/**
 * entity.ts — Core types for the Content OS generic content engine.
 * An "entity" is the universal parent: exam, job, scholarship, news article, etc.
 * entity_type is a free-text field — not an enum — so new types need no schema change.
 *
 * M3.8/M3.9: Updated workflow states. Added template_snapshot, content_type_id,
 * last_verified_at, stage_key, event_subtype. (ADR-001, ADR-005, ADR-007)
 */

import type { TemplateConfiguration } from './lifecycle-template'

// ── Workflow (ADR-007 — Universal, no per-template variance) ─────────────────

export type WorkflowStatus =
  | 'draft'
  | 'review'
  | 'published'
  | 'archived'
  | 'hidden'
  | 'deleted'

/** Tuple of all valid WorkflowStatus values — used for Zod enum validation */
export const WORKFLOW_STATUS_VALUES = [
  'draft', 'review', 'published', 'archived', 'hidden', 'deleted',
] as const

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft:     'Draft',
  review:    'In Review',
  published: 'Published',
  archived:  'Archived',
  hidden:    'Hidden',
  deleted:   'Deleted',
}

/** All valid state transitions (from → to[]).  Source of truth for all workflow validation. */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft:     ['review'],
  review:    ['draft', 'published'],
  published: ['archived', 'hidden'],
  archived:  ['draft'],
  hidden:    ['draft', 'archived'],
  deleted:   [],  // terminal state
}

// ── Block system ─────────────────────────────────────────────────────────────

export type BlockType =
  | 'heading' | 'paragraph' | 'rich_text' | 'image' | 'gallery'
  | 'table' | 'download_card' | 'button' | 'alert_box' | 'timeline'
  | 'faq' | 'video' | 'quote' | 'divider' | 'html'

export type HeadingContent   = { type: 'heading';       level: 1|2|3|4|5|6; text: string }
export type ParagraphContent = { type: 'paragraph';     html: string }
export type RichTextContent  = { type: 'rich_text';     html: string }
export type ImageContent     = { type: 'image';         url: string; alt: string; caption?: string }
export type GalleryContent   = { type: 'gallery';       images: Array<{ url: string; alt: string; caption?: string }> }
export type TableContent     = { type: 'table';         headers: string[]; rows: string[][] }
export type DownloadCardContent = { type: 'download_card'; downloadId: string }
export type ButtonContent    = { type: 'button';        text: string; url: string; style: 'primary'|'secondary'|'outline' }
export type AlertContent     = { type: 'alert_box';     variant: 'info'|'warning'|'error'|'success'; title: string; body: string }
export type TimelineContent  = { type: 'timeline';      eventIds: string[] }
export type FAQContent       = { type: 'faq';           faqs: Array<{ q: string; a: string }> }
export type VideoContent     = { type: 'video';         url: string; provider: 'youtube'|'vimeo'|'direct'; caption?: string }
export type QuoteContent     = { type: 'quote';         text: string; attribution?: string }
export type DividerContent   = { type: 'divider';       style: 'line'|'space' }
export type HTMLContent      = { type: 'html';          raw: string }

/** Discriminated union of all block content types */
export type BlockContent =
  | HeadingContent | ParagraphContent | RichTextContent
  | ImageContent | GalleryContent | TableContent
  | DownloadCardContent | ButtonContent | AlertContent
  | TimelineContent | FAQContent | VideoContent
  | QuoteContent | DividerContent | HTMLContent

export interface ModuleBlock {
  id: string
  moduleId: string
  blockType: string       // free-text: extensible via plugin registry
  displayOrder: number
  content: BlockContent | Record<string, unknown>  // unknown for custom block types
  isVisible: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

// ── Entity Module ─────────────────────────────────────────────────────────────

export type Visibility = 'public' | 'logged_in' | 'admin'

export interface EntityModule {
  id: string
  entityId: string
  moduleType: string          // free-text — extensible
  subTitle?: string | null
  displayOrder: number
  workflowStatus: WorkflowStatus
  isFeatured: boolean
  tags: string[]
  scheduledPublishAt?: string | null
  publishedAt?: string | null
  publishedBy?: string | null
  seoOverrideTitle?: string | null
  seoOverrideDesc?: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
  deletedAt?: string | null
  // Hydrated when module is opened
  blocks?: ModuleBlock[]
}

// ── Entity (parent) ───────────────────────────────────────────────────────────

export interface Entity {
  id: string
  entityType: string          // free-text — extensible without schema changes (ADR-001)
  slug: string
  name: string
  shortName?: string | null
  officialWebsite?: string | null
  // Classification (FK references)
  pillar?: string | null      // references pillar.slug
  contentTypeId?: string | null
  templateVersionId?: string | null  // read-only audit reference (ADR-005)
  /** Immutable after creation — frozen copy of template version's configuration */
  templateSnapshot: TemplateConfiguration
  // Descriptive taxonomy FKs
  conductingBodyId?: string | null
  categoryId?: string | null
  departmentId?: string | null
  examLevelId?: string | null
  examModeId?: string | null
  applicationModeId?: string | null
  // Legacy text fields
  subType?: string | null
  examFrequency?: string | null
  // Workflow (ADR-007 — universal state machine)
  workflowStatus: WorkflowStatus
  isFeatured: boolean
  priority?: number | null
  featuredUntil?: string | null
  tags: string[]
  searchKeywords: string[]
  scheduledPublishAt?: string | null
  publishedAt?: string | null
  publishedBy?: string | null
  lang: string
  // Verification (separate from updated_at — ADR-011)
  lastVerifiedAt?: string | null
  lastVerifiedBy?: string | null
  // Template-specific fields stored as JSONB (dynamic field definitions with storeIn:'metadata')
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
  deletedAt?: string | null
}

/** Full entity with all satellite relations hydrated (used in editor) */
export interface EntityFull extends Entity {
  overview?: EntityOverview | null
  timelineEvents: TimelineEvent[]
  modules: EntityModule[]
  eligibility?: EntityEligibility | null
  vacancies: EntityVacancy[]
  fee?: EntityFee | null
  examPattern: EntityExamPattern[]
  selectionStages: EntitySelectionStage[]
  syllabusSubjects: EntitySyllabusSubject[]
  seo?: EntitySeo | null
  downloads: EntityDownload[]
  links: EntityLink[]
  media: EntityMediaMap
  revisions: RevisionSummary[]
  brokenLinkCount: number
  completenessScore: number
}

/** Lightweight list item for ExamsListPage */
export interface EntityListItem {
  id: string
  entityType: string
  slug: string
  name: string
  shortName?: string | null
  pillar?: string | null
  workflowStatus: WorkflowStatus
  isFeatured: boolean
  priority?: number | null
  updatedAt: string
  completenessScore?: number
  brokenLinkCount?: number
}

// ── Satellite types ───────────────────────────────────────────────────────────

export interface EntityOverview {
  id: string
  entityId: string
  section: string   // 'summary' | 'about' | 'why' | 'career' | 'salary' | 'job_profile' | 'promotion' | 'work_location'
  html: string
  updatedAt: string
}

export interface TimelineEvent {
  id: string
  entityId: string
  /** Loose reference to template's stage definition by key (NOT a FK) */
  stageKey?: string | null
  /** Optional subtype within a stage, e.g. 'application_open', 'application_close' */
  eventSubtype?: string | null
  title: string
  eventType: string
  eventDate?: string | null   // nullable: stub events created without dates
  eventTime?: string | null
  description?: string | null
  status: 'pending' | 'upcoming' | 'active' | 'passed' | 'postponed' | 'cancelled'
  badgeColor: string
  isHighlighted: boolean
  isFeatured: boolean
  officialLink?: string | null
  pdfLink?: string | null
  imageUrl?: string | null
  visibility: Visibility
  displayOrder: number
  publishAt?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface EntityEligibility {
  id: string
  entityId: string
  minAge?: number | null
  maxAge?: number | null
  ageRelaxation: Array<{ category: string; years: number; notes?: string }>
  nationality?: string | null
  education?: string | null
  experience?: string | null
  maxAttempts?: number | null
  physicalStandards?: string | null
  medicalStandards?: string | null
  languageRequirements?: string | null
  updatedAt: string
}

export interface EntityVacancy {
  id: string
  entityId: string
  category: string
  label: string
  value: number
  notes?: string | null
  displayOrder: number
  deletedAt?: string | null
}

export interface EntityFee {
  id: string
  entityId: string
  general?: number | null
  obc?: number | null
  sc?: number | null
  st?: number | null
  ews?: number | null
  pwd?: number | null
  female?: number | null
  paymentModes: string[]
  refundRules?: string | null
  updatedAt: string
}

export interface EntityExamPattern {
  id: string
  entityId: string
  stageName: string
  durationMinutes?: number | null
  totalQuestions?: number | null
  totalMarks?: number | null
  negativeMarking?: number | null
  subjects: string[]
  examLanguage?: string | null
  qualifyingMarks?: string | null
  notes?: string | null
  displayOrder: number
  deletedAt?: string | null
}

export interface EntitySelectionStage {
  id: string
  entityId: string
  stageName: string
  description?: string | null
  marks?: number | null
  weightagePercent?: number | null
  isQualifying: boolean
  notes?: string | null
  displayOrder: number
  deletedAt?: string | null
}

export interface EntitySyllabusSubject {
  id: string
  entityId: string
  subjectName: string
  topics: string[]
  description?: string | null
  pdfUrl?: string | null
  videoLink?: string | null
  studyNotes?: string | null
  books?: string | null
  weightagePercent?: number | null
  displayOrder: number
  deletedAt?: string | null
}

export interface EntitySeo {
  id: string
  entityId: string
  seoTitle?: string | null
  metaDescription?: string | null
  focusKeywords: string[]
  canonicalUrl?: string | null
  robots: string
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  twitterCard: string
  twitterTitle?: string | null
  twitterDescription?: string | null
  twitterImage?: string | null
  faqSchema?: Record<string, unknown> | null
  breadcrumbSchema?: Record<string, unknown> | null
  customJsonLd?: string | null
  seoScore?: number | null
  updatedAt: string
  updatedBy?: string | null
}

export interface MediaItem {
  id: string
  filename: string
  storagePath: string
  publicUrl: string
  mimeType: string
  sizeBytes: number
  width?: number | null
  height?: number | null
  altText?: string | null
  caption?: string | null
  folder: string
  tags: string[]
  variants: Record<string, string>
  usageCount: number
  uploadedBy?: string | null
  createdAt: string
  deletedAt?: string | null
}

export interface EntityMediaSlot {
  id: string
  entityId: string
  mediaId: string
  slot: string
  displayOrder: number
  createdAt: string
  media?: MediaItem
}

export interface EntityMediaMap {
  thumbnail?: MediaItem | null
  banner?: MediaItem | null
  ogImage?: MediaItem | null
  gallery: MediaItem[]
  infographics: MediaItem[]
  timelineImages: MediaItem[]
  resultImages: MediaItem[]
  admitCardImages: MediaItem[]
}

export interface EntityDownload {
  id: string
  entityId: string
  downloadName: string
  category?: string | null
  mediaId?: string | null
  externalUrl?: string | null
  fileType?: string | null
  version?: string | null
  description?: string | null
  language: string
  isVisible: boolean
  buttonText: string
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  media?: MediaItem | null
}

export interface EntityLink {
  id: string
  entityId: string
  label: string
  url: string
  icon?: string | null
  buttonStyle: string
  status: 'active' | 'inactive'
  displayOrder: number
  createdAt: string
  deletedAt?: string | null
}

export interface EntityRevision {
  id: string
  entityId: string
  versionNumber: number
  snapshot: EntityFull
  comment?: string | null
  createdBy?: string | null
  createdAt: string
}

export interface RevisionSummary {
  id: string
  versionNumber: number
  comment?: string | null
  createdBy?: string | null
  createdAt: string
}

export interface ActivityLogEntry {
  id: string
  entityId?: string | null
  moduleId?: string | null
  actorId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  changes?: Record<string, unknown> | null
  createdAt: string
}

// ── Exam Data Deduplication types (Reqs 1, 3, 8, 15) ─────────────────────────

/** Standard date types stored in entity_timeline_event.event_type */
export const STANDARD_DATE_TYPES = [
  'notification_date',
  'application_start',
  'application_end',
  'fee_payment_last_date',
  'exam_date',
  'admit_card_release',
  'answer_key_release',
  'result_date',
] as const

export type StandardDateType = typeof STANDARD_DATE_TYPES[number]

/** Human-readable labels for standard date types */
export const STANDARD_DATE_LABELS: Record<StandardDateType, string> = {
  notification_date: 'Notification Date',
  application_start: 'Application Start Date',
  application_end: 'Application End Date',
  fee_payment_last_date: 'Fee Payment Last Date',
  exam_date: 'Exam Date',
  admit_card_release: 'Admit Card Release Date',
  answer_key_release: 'Answer Key Release Date',
  result_date: 'Result Date',
}

/** Date entry as consumed by TimelineDatesContext */
export interface DateEntry {
  eventType: string
  date: string | null
  isHighlighted: boolean
  title: string
}

/** Conducting body lookup table record (supports parent/child hierarchy) */
export interface ConductingBody {
  id: string
  name: string
  shortName: string | null
  slug: string
  officialWebsite: string | null
  parentId: string | null
  createdAt: string
  updatedAt: string
}

/** Dashboard activity feed entry (resolved with entity name and actor name) */
export interface DashboardActivityEntry {
  id: string
  entityId: string
  entityName: string
  moduleId: string | null
  moduleType: string
  actorId: string
  actorName: string
  action: 'module_filled' | 'module_updated'
  createdAt: string
}

/** Mapping of module_block.content JSON keys to standard date types (for Migration 2b) */
export const MODULE_DATE_KEY_MAP: Record<string, StandardDateType> = {
  admitCardReleaseDate: 'admit_card_release',
  examDate: 'exam_date',
  resultDeclaredDate: 'result_date',
  releaseDate: 'answer_key_release',
  applicationStartDate: 'application_start',
  applicationEndDate: 'application_end',
  notificationDate: 'notification_date',
}
