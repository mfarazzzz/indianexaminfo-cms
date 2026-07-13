/**
 * entitySchemas.ts — Zod validation schemas for all ELMS entity forms.
 * Each schema enforces the exact constraints from requirements R1–R16.
 */
import { z } from 'zod'
import { WORKFLOW_STATUS_VALUES } from '@/types/entity'

// ── Helpers ──────────────────────────────────────────────────────────────────

const urlSchema = z
  .string()
  .optional()
  .nullable()
  .refine(
    (v) => !v || /^https?:\/\/.+\..+/.test(v),
    { message: 'Must be a valid URL (e.g. https://example.com)' }
  )

const slugSchema = z
  .string()
  .max(255, 'Slug must be 255 characters or less')
  .regex(/^[a-z0-9-]*$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

/** Auto-generate a slug from a name string */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 255)
}

// ── Entity (General tab) ─────────────────────────────────────────────────────

export const EntityCreateSchema = z.object({
  name:            z.string().min(1, 'Exam name is required').max(200, 'Max 200 characters'),
  shortName:       z.string().max(100).optional().nullable(),
  slug:            slugSchema,
  conductingBody:  z.string().max(200).optional().nullable(),
  officialWebsite: urlSchema,
  categoryId:      z.string().uuid().optional().nullable(),
  pillar:          z.string().optional().nullable(),
  subType:         z.string().optional().nullable(),
  examLevel:       z.string().optional().nullable(),
  examMode:        z.string().optional().nullable(),
  applicationMode: z.string().optional().nullable(),
  examFrequency:   z.string().optional().nullable(),
  workflowStatus:  z.enum(WORKFLOW_STATUS_VALUES).default('draft'),
  isFeatured:      z.boolean().default(false),
  priority:        z.number().int().min(1).max(999).optional().nullable(),
  featuredUntil:   z.string().optional().nullable(),
  tags:            z.array(z.string()).default([]),
  searchKeywords:  z.array(z.string()).default([]),
  lang:            z.string().default('en'),
})

export type EntityCreateInput = z.infer<typeof EntityCreateSchema>

// ── Timeline Event ────────────────────────────────────────────────────────────

export const TimelineEventSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(300),
  eventType:    z.string().min(1, 'Event type is required'),
  eventDate:    z.string().min(1, 'Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  eventTime:    z.string().optional().nullable(),
  description:  z.string().max(2000).optional().nullable(),
  status:       z.enum(['upcoming', 'active', 'passed', 'postponed', 'cancelled']).default('upcoming'),
  badgeColor:   z.enum(['blue', 'green', 'yellow', 'orange', 'red', 'grey']).default('blue'),
  isHighlighted: z.boolean().default(false),
  isFeatured:   z.boolean().default(false),
  officialLink: urlSchema,
  pdfLink:      urlSchema,
  visibility:   z.enum(['public', 'logged_in', 'admin']).default('public'),
  displayOrder: z.number().int().default(0),
  publishAt:    z.string().optional().nullable(),
})

export type TimelineEventInput = z.infer<typeof TimelineEventSchema>

// ── Module ────────────────────────────────────────────────────────────────────

export const ModuleCreateSchema = z.object({
  moduleType:          z.string().min(1, 'Module type is required'),
  subTitle:            z.string().max(200).optional().nullable(),
  displayOrder:        z.number().int().default(0),
  workflowStatus:      z.enum(WORKFLOW_STATUS_VALUES).default('draft'),
  isFeatured:          z.boolean().default(false),
  tags:                z.array(z.string()).default([]),
  scheduledPublishAt:  z.string().optional().nullable(),
  seoOverrideTitle:    z.string().max(60).optional().nullable(),
  seoOverrideDesc:     z.string().max(160).optional().nullable(),
})

export type ModuleCreateInput = z.infer<typeof ModuleCreateSchema>

// ── Eligibility ───────────────────────────────────────────────────────────────

export const EligibilitySchema = z.object({
  minAge:               z.number().int().min(0).optional().nullable(),
  maxAge:               z.number().int().min(0).optional().nullable(),
  ageRelaxation:        z.array(z.object({
    category: z.string().min(1),
    years:    z.number().int().min(0),
    notes:    z.string().optional(),
  })).default([]),
  nationality:          z.string().optional().nullable(),
  education:            z.string().optional().nullable(),
  experience:           z.string().optional().nullable(),
  maxAttempts:          z.number().int().min(0).optional().nullable(),
  physicalStandards:    z.string().optional().nullable(),
  medicalStandards:     z.string().optional().nullable(),
  languageRequirements: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.minAge != null && data.maxAge != null) {
      return data.minAge <= data.maxAge
    }
    return true
  },
  { message: 'Minimum age must be less than or equal to maximum age', path: ['minAge'] }
)

export type EligibilityInput = z.infer<typeof EligibilitySchema>

// ── Vacancy row ───────────────────────────────────────────────────────────────

export const VacancyRowSchema = z.object({
  category:     z.string().min(1),
  label:        z.string().min(1, 'Label is required'),
  value:        z.number().int('Must be a whole number').min(0, 'Value must be 0 or greater'),
  notes:        z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
})

export type VacancyRowInput = z.infer<typeof VacancyRowSchema>

// ── Fee ────────────────────────────────────────────────────────────────────────

export const FeeSchema = z.object({
  general:      z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  obc:          z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  sc:           z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  st:           z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  ews:          z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  pwd:          z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  female:       z.number().int().min(0, 'Fee cannot be negative').optional().nullable(),
  paymentModes: z.array(z.string()).default([]),
  refundRules:  z.string().optional().nullable(),
})

export type FeeInput = z.infer<typeof FeeSchema>

// ── Exam Pattern Stage ────────────────────────────────────────────────────────

export const ExamPatternStageSchema = z.object({
  stageName:       z.string().min(1, 'Stage name is required').max(200),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  totalQuestions:  z.number().int().min(0).optional().nullable(),
  totalMarks:      z.number().int().min(0).optional().nullable(),
  negativeMarking: z.number().min(0).max(99.99).optional().nullable(),
  subjects:        z.array(z.string()).default([]),
  examLanguage:    z.string().optional().nullable(),
  qualifyingMarks: z.string().optional().nullable(),
  notes:           z.string().optional().nullable(),
  displayOrder:    z.number().int().default(0),
})

export type ExamPatternStageInput = z.infer<typeof ExamPatternStageSchema>

// ── Selection Stage ───────────────────────────────────────────────────────────

export const SelectionStageSchema = z.object({
  stageName:        z.string().min(1, 'Stage name is required').max(200),
  description:      z.string().optional().nullable(),
  marks:            z.number().int().min(0).optional().nullable(),
  weightagePercent: z.number().min(0).max(100).optional().nullable(),
  isQualifying:     z.boolean().default(false),
  notes:            z.string().optional().nullable(),
  displayOrder:     z.number().int().default(0),
})

export type SelectionStageInput = z.infer<typeof SelectionStageSchema>

// ── Syllabus Subject ──────────────────────────────────────────────────────────

export const SyllabusSubjectSchema = z.object({
  subjectName:      z.string().min(1, 'Subject name is required').max(200),
  topics:           z.array(z.string()).default([]),
  description:      z.string().optional().nullable(),
  pdfUrl:           urlSchema,
  videoLink:        urlSchema,
  studyNotes:       z.string().optional().nullable(),
  books:            z.string().optional().nullable(),
  weightagePercent: z.number().min(0).max(100).optional().nullable(),
  displayOrder:     z.number().int().default(0),
})

export type SyllabusSubjectInput = z.infer<typeof SyllabusSubjectSchema>

// ── SEO ────────────────────────────────────────────────────────────────────────

export const SEOSchema = z.object({
  seoTitle:           z.string().max(200).optional().nullable(),  // warn at 60, don't block
  metaDescription:    z.string().max(500).optional().nullable(),  // warn at 160, don't block
  focusKeywords:      z.array(z.string()).default([]),
  canonicalUrl:       urlSchema,
  robots:             z.enum(['index', 'noindex', 'nofollow', 'noindex,nofollow']).default('index'),
  ogTitle:            z.string().max(200).optional().nullable(),
  ogDescription:      z.string().max(300).optional().nullable(),
  ogImage:            urlSchema,
  twitterCard:        z.enum(['summary', 'summary_large_image']).default('summary_large_image'),
  twitterTitle:       z.string().max(200).optional().nullable(),
  twitterDescription: z.string().max(300).optional().nullable(),
  twitterImage:       urlSchema,
  customJsonLd:       z.string().optional().nullable(),
})

export type SEOInput = z.infer<typeof SEOSchema>

// ── Link ──────────────────────────────────────────────────────────────────────

export const LinkSchema = z.object({
  label:        z.string().min(1, 'Label is required').max(200),
  url:          z.string().min(1, 'URL is required').regex(/^https?:\/\/.+\..+/, 'Must be a valid URL'),
  icon:         z.string().optional().nullable(),
  buttonStyle:  z.enum(['primary', 'secondary', 'outline', 'text']).default('primary'),
  status:       z.enum(['active', 'inactive']).default('active'),
  displayOrder: z.number().int().default(0),
})

export type LinkInput = z.infer<typeof LinkSchema>

// ── Download ──────────────────────────────────────────────────────────────────

export const DownloadSchema = z.object({
  downloadName: z.string().min(1, 'Name is required').max(300),
  category:     z.string().optional().nullable(),
  mediaId:      z.string().uuid().optional().nullable(),
  externalUrl:  urlSchema,
  fileType:     z.enum(['pdf', 'zip', 'doc']).optional().nullable(),
  version:      z.string().max(50).optional().nullable(),
  description:  z.string().max(500).optional().nullable(),
  language:     z.string().default('en'),
  isVisible:    z.boolean().default(true),
  buttonText:   z.string().max(100).default('Download'),
  displayOrder: z.number().int().default(0),
})

export type DownloadInput = z.infer<typeof DownloadSchema>
