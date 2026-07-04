/**
 * entity.ts — Core types for the Content OS (ELMS) generic content engine.
 * An "entity" is the universal parent: exam, job, scholarship, admission, etc.
 * entity_type is a free-text field — not an enum — so new types need no schema change.
 */

// ── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'draft'
  | 'in_review'
  | 'seo_review'
  | 'legal_review'
  | 'scheduled'
  | 'published'
  | 'archived'

/** Tuple of all valid WorkflowStatus values — used for Zod enum validation */
export const WORKFLOW_STATUS_VALUES = [
  'draft', 'in_review', 'seo_review', 'legal_review',
  'scheduled', 'published', 'archived',
] as const

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft:        'Draft',
  in_review:    'In Review',
  seo_review:   'SEO Review',
  legal_review: 'Legal Review',
  scheduled:    'Scheduled',
  published:    'Published',
  archived:     'Archived',
}

/** All valid state transitions (from → to[]) */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft:        ['in_review'],
  in_review:    ['seo_review', 'draft'],
  seo_review:   ['legal_review', 'draft'],
  legal_review: ['scheduled', 'published', 'draft'],
  scheduled:    ['published', 'draft'],
  published:    ['archived', 'draft'],
  archived:     ['draft'],
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
  entityType: string          // 'exam' | 'job' | 'scholarship' | ... (extensible)
  slug: string
  name: string
  shortName?: string | null
  conductingBody?: string | null
  officialWebsite?: string | null
  categoryId?: string | null
  pillar?: string | null
  subType?: string | null
  examLevel?: string | null
  examMode?: string | null
  applicationMode?: string | null
  examFrequency?: string | null
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
  title: string
  eventType: string
  eventDate: string
  eventTime?: string | null
  description?: string | null
  status: 'upcoming' | 'active' | 'passed' | 'postponed' | 'cancelled'
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
