/**
 * sarkariNaukriService.ts — CRUD for `sarkari_naukri` table.
 * Unified government jobs: exam-based (Sarkari Exam) + direct/merit (Sarkari Bharti).
 * No React imports. Business logic only.
 */
import { db } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecruitmentType = 'exam' | 'direct'

export type SarkariStatus =
  | 'upcoming' | 'application-open' | 'application-closed'
  | 'admit-card-released' | 'exam-scheduled' | 'answer-key-released'
  | 'result-declared' | 'interview-scheduled' | 'merit-list-released'
  | 'completed' | 'cancelled'

export type WorkflowStatus = 'draft' | 'review' | 'published' | 'archived'

export interface SarkariNaukri {
  id: string
  slug: string
  recruitmentType: RecruitmentType
  title: string
  titleHindi: string | null
  organization: string
  organizationHindi: string | null
  department: string | null
  state: string | null
  district: string | null
  category: string | null
  vacancyCount: number | null
  eligibility: string | null
  ageLimit: string | null
  payScale: string | null
  applicationFee: Record<string, unknown> | null
  description: string | null
  descriptionHindi: string | null
  // Application
  notificationDate: string | null
  applicationStartDate: string | null
  applicationEndDate: string | null
  applicationUrl: string | null
  officialNotificationUrl: string | null
  // Exam-specific
  examDate: string | null
  admitCardDate: string | null
  admitCardUrl: string | null
  answerKeyDate: string | null
  answerKeyUrl: string | null
  examMode: string | null
  // Result
  resultDate: string | null
  resultUrl: string | null
  cutoffMarks: string | null
  totalCandidates: number | null
  passPercentage: number | null
  // Direct-specific
  interviewDate: string | null
  documentVerificationDate: string | null
  meritListDate: string | null
  meritListUrl: string | null
  joiningDetails: string | null
  walkInDate: string | null
  walkInVenue: string | null
  // Status
  status: SarkariStatus
  isNew: boolean
  isFeatured: boolean
  isUrgent: boolean
  // SEO
  tags: string[]
  searchKeywords: string[]
  seoTitle: string | null
  seoDescription: string | null
  // Media
  imageId: string | null
  alternateLinks: Record<string, string>[] | null
  // Workflow
  workflowStatus: WorkflowStatus
  publishedAt: string | null
  // Provenance
  sourceTable: string | null
  sourceId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface SarkariNaukriInput {
  slug: string
  recruitmentType: RecruitmentType
  title: string
  titleHindi?: string | null
  organization: string
  organizationHindi?: string | null
  department?: string | null
  state?: string | null
  district?: string | null
  category?: string | null
  vacancyCount?: number | null
  eligibility?: string | null
  ageLimit?: string | null
  payScale?: string | null
  applicationFee?: Record<string, unknown> | null
  description?: string | null
  descriptionHindi?: string | null
  notificationDate?: string | null
  applicationStartDate?: string | null
  applicationEndDate?: string | null
  applicationUrl?: string | null
  officialNotificationUrl?: string | null
  examDate?: string | null
  admitCardDate?: string | null
  admitCardUrl?: string | null
  answerKeyDate?: string | null
  answerKeyUrl?: string | null
  examMode?: string | null
  resultDate?: string | null
  resultUrl?: string | null
  cutoffMarks?: string | null
  totalCandidates?: number | null
  passPercentage?: number | null
  interviewDate?: string | null
  documentVerificationDate?: string | null
  meritListDate?: string | null
  meritListUrl?: string | null
  joiningDetails?: string | null
  walkInDate?: string | null
  walkInVenue?: string | null
  status?: SarkariStatus
  isNew?: boolean
  isFeatured?: boolean
  isUrgent?: boolean
  tags?: string[]
  searchKeywords?: string[]
  seoTitle?: string | null
  seoDescription?: string | null
  imageId?: string | null
  alternateLinks?: Record<string, string>[] | null
  workflowStatus?: WorkflowStatus
  createdBy?: string | null
}

export interface SarkariNaukriListOpts {
  recruitmentType?: RecruitmentType
  status?: string
  state?: string
  category?: string
  department?: string
  search?: string
  isFeatured?: boolean
  isNew?: boolean
  workflowStatus?: string
  limit?: number
  offset?: number
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): SarkariNaukri {
  return {
    id:                       r.id as string,
    slug:                     r.slug as string,
    recruitmentType:          r.recruitment_type as RecruitmentType,
    title:                    r.title as string,
    titleHindi:               r.title_hindi as string | null,
    organization:             r.organization as string,
    organizationHindi:        r.organization_hindi as string | null,
    department:               r.department as string | null,
    state:                    r.state as string | null,
    district:                 r.district as string | null,
    category:                 r.category as string | null,
    vacancyCount:             r.vacancy_count as number | null,
    eligibility:              r.eligibility as string | null,
    ageLimit:                 r.age_limit as string | null,
    payScale:                 r.pay_scale as string | null,
    applicationFee:           r.application_fee as Record<string, unknown> | null,
    description:              r.description as string | null,
    descriptionHindi:         r.description_hindi as string | null,
    notificationDate:         r.notification_date as string | null,
    applicationStartDate:     r.application_start_date as string | null,
    applicationEndDate:       r.application_end_date as string | null,
    applicationUrl:           r.application_url as string | null,
    officialNotificationUrl:  r.official_notification_url as string | null,
    examDate:                 r.exam_date as string | null,
    admitCardDate:            r.admit_card_date as string | null,
    admitCardUrl:             r.admit_card_url as string | null,
    answerKeyDate:            r.answer_key_date as string | null,
    answerKeyUrl:             r.answer_key_url as string | null,
    examMode:                 r.exam_mode as string | null,
    resultDate:               r.result_date as string | null,
    resultUrl:                r.result_url as string | null,
    cutoffMarks:              r.cutoff_marks as string | null,
    totalCandidates:          r.total_candidates as number | null,
    passPercentage:           r.pass_percentage as number | null,
    interviewDate:            r.interview_date as string | null,
    documentVerificationDate: r.document_verification_date as string | null,
    meritListDate:            r.merit_list_date as string | null,
    meritListUrl:             r.merit_list_url as string | null,
    joiningDetails:           r.joining_details as string | null,
    walkInDate:               r.walk_in_date as string | null,
    walkInVenue:              r.walk_in_venue as string | null,
    status:                   (r.status as SarkariStatus) ?? 'upcoming',
    isNew:                    (r.is_new as boolean) ?? false,
    isFeatured:               (r.is_featured as boolean) ?? false,
    isUrgent:                 (r.is_urgent as boolean) ?? false,
    tags:                     (r.tags as string[]) ?? [],
    searchKeywords:           (r.search_keywords as string[]) ?? [],
    seoTitle:                 r.seo_title as string | null,
    seoDescription:           r.seo_description as string | null,
    imageId:                  r.image_id as string | null,
    alternateLinks:           r.alternate_links as Record<string, string>[] | null,
    workflowStatus:           (r.workflow_status as WorkflowStatus) ?? 'draft',
    publishedAt:              r.published_at as string | null,
    sourceTable:              r.source_table as string | null,
    sourceId:                 r.source_id as string | null,
    createdBy:                r.created_by as string | null,
    createdAt:                r.created_at as string,
    updatedAt:                r.updated_at as string,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listSarkariNaukri(
  opts: SarkariNaukriListOpts = {}
): Promise<{ data: SarkariNaukri[]; count: number }> {
  let q = db
    .from('sarkari_naukri')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (opts.recruitmentType) q = q.eq('recruitment_type', opts.recruitmentType)
  if (opts.status)          q = q.eq('status', opts.status)
  if (opts.state)           q = q.eq('state', opts.state)
  if (opts.category)        q = q.eq('category', opts.category)
  if (opts.department)      q = q.ilike('department', `%${opts.department}%`)
  if (opts.workflowStatus)  q = q.eq('workflow_status', opts.workflowStatus)
  if (opts.isFeatured !== undefined) q = q.eq('is_featured', opts.isFeatured)
  if (opts.isNew !== undefined)      q = q.eq('is_new', opts.isNew)
  if (opts.search)          q = q.ilike('title', `%${opts.search}%`)
  if (opts.limit)           q = q.limit(opts.limit)
  if (opts.offset)          q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 }
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getSarkariNaukriById(id: string): Promise<SarkariNaukri | null> {
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Get by Slug ───────────────────────────────────────────────────────────────

export async function getSarkariNaukriBySlug(slug: string): Promise<SarkariNaukri | null> {
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSarkariNaukri(input: SarkariNaukriInput): Promise<SarkariNaukri> {
  const existing = await getSarkariNaukriBySlug(input.slug)
  if (existing) throw new Error(`Slug "${input.slug}" is already in use.`)

  const status = input.workflowStatus ?? 'draft'
  const publishedAt = status === 'published' ? new Date().toISOString() : null

  const { data, error } = await db
    .from('sarkari_naukri')
    .insert({
      slug: input.slug,
      recruitment_type: input.recruitmentType,
      title: input.title,
      title_hindi: input.titleHindi ?? null,
      organization: input.organization,
      organization_hindi: input.organizationHindi ?? null,
      department: input.department ?? null,
      state: input.state ?? null,
      district: input.district ?? null,
      category: input.category ?? null,
      vacancy_count: input.vacancyCount ?? null,
      eligibility: input.eligibility ?? null,
      age_limit: input.ageLimit ?? null,
      pay_scale: input.payScale ?? null,
      application_fee: input.applicationFee ?? null,
      description: input.description ?? null,
      description_hindi: input.descriptionHindi ?? null,
      notification_date: input.notificationDate ?? null,
      application_start_date: input.applicationStartDate ?? null,
      application_end_date: input.applicationEndDate ?? null,
      application_url: input.applicationUrl ?? null,
      official_notification_url: input.officialNotificationUrl ?? null,
      exam_date: input.examDate ?? null,
      admit_card_date: input.admitCardDate ?? null,
      admit_card_url: input.admitCardUrl ?? null,
      answer_key_date: input.answerKeyDate ?? null,
      answer_key_url: input.answerKeyUrl ?? null,
      exam_mode: input.examMode ?? null,
      result_date: input.resultDate ?? null,
      result_url: input.resultUrl ?? null,
      cutoff_marks: input.cutoffMarks ?? null,
      total_candidates: input.totalCandidates ?? null,
      pass_percentage: input.passPercentage ?? null,
      interview_date: input.interviewDate ?? null,
      document_verification_date: input.documentVerificationDate ?? null,
      merit_list_date: input.meritListDate ?? null,
      merit_list_url: input.meritListUrl ?? null,
      joining_details: input.joiningDetails ?? null,
      walk_in_date: input.walkInDate ?? null,
      walk_in_venue: input.walkInVenue ?? null,
      status: input.status ?? 'upcoming',
      is_new: input.isNew ?? false,
      is_featured: input.isFeatured ?? false,
      is_urgent: input.isUrgent ?? false,
      tags: input.tags ?? [],
      search_keywords: input.searchKeywords ?? [],
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      image_id: input.imageId ?? null,
      alternate_links: input.alternateLinks ?? null,
      workflow_status: status,
      published_at: publishedAt,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateSarkariNaukri(id: string, input: Partial<SarkariNaukriInput>): Promise<SarkariNaukri> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const fieldMap: Record<string, string> = {
    slug: 'slug', recruitmentType: 'recruitment_type',
    title: 'title', titleHindi: 'title_hindi',
    organization: 'organization', organizationHindi: 'organization_hindi',
    department: 'department', state: 'state', district: 'district',
    category: 'category', vacancyCount: 'vacancy_count',
    eligibility: 'eligibility', ageLimit: 'age_limit', payScale: 'pay_scale',
    applicationFee: 'application_fee',
    description: 'description', descriptionHindi: 'description_hindi',
    notificationDate: 'notification_date',
    applicationStartDate: 'application_start_date',
    applicationEndDate: 'application_end_date',
    applicationUrl: 'application_url',
    officialNotificationUrl: 'official_notification_url',
    examDate: 'exam_date', admitCardDate: 'admit_card_date',
    admitCardUrl: 'admit_card_url', answerKeyDate: 'answer_key_date',
    answerKeyUrl: 'answer_key_url', examMode: 'exam_mode',
    resultDate: 'result_date', resultUrl: 'result_url',
    cutoffMarks: 'cutoff_marks', totalCandidates: 'total_candidates',
    passPercentage: 'pass_percentage',
    interviewDate: 'interview_date',
    documentVerificationDate: 'document_verification_date',
    meritListDate: 'merit_list_date', meritListUrl: 'merit_list_url',
    joiningDetails: 'joining_details', walkInDate: 'walk_in_date',
    walkInVenue: 'walk_in_venue',
    status: 'status', isNew: 'is_new', isFeatured: 'is_featured',
    isUrgent: 'is_urgent', tags: 'tags', searchKeywords: 'search_keywords',
    seoTitle: 'seo_title', seoDescription: 'seo_description',
    imageId: 'image_id', alternateLinks: 'alternate_links',
    createdBy: 'created_by',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[key]
    }
  }

  if (input.workflowStatus !== undefined) {
    updates.workflow_status = input.workflowStatus
    if (input.workflowStatus === 'published') {
      updates.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await db
    .from('sarkari_naukri')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Publish / Archive / Delete ────────────────────────────────────────────────

export async function publishSarkariNaukri(id: string): Promise<SarkariNaukri> {
  return updateSarkariNaukri(id, { workflowStatus: 'published' })
}

export async function archiveSarkariNaukri(id: string): Promise<SarkariNaukri> {
  return updateSarkariNaukri(id, { workflowStatus: 'archived' })
}

export async function deleteSarkariNaukri(id: string): Promise<void> {
  const { error } = await db.from('sarkari_naukri').delete().eq('id', id)
  if (error) throw error
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export async function bulkPublish(ids: string[]): Promise<void> {
  const { error } = await db
    .from('sarkari_naukri')
    .update({ workflow_status: 'published', published_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function bulkArchive(ids: string[]): Promise<void> {
  const { error } = await db
    .from('sarkari_naukri')
    .update({ workflow_status: 'archived' })
    .in('id', ids)
  if (error) throw error
}

export async function bulkDelete(ids: string[]): Promise<void> {
  const { error } = await db.from('sarkari_naukri').delete().in('id', ids)
  if (error) throw error
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchSarkariNaukri(query: string, limit = 20): Promise<SarkariNaukri[]> {
  if (!query.trim()) return []
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('*')
    .or(`title.ilike.%${query}%,organization.ilike.%${query}%,department.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => mapRow(r))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getSarkariNaukriStats(): Promise<{
  total: number; exam: number; direct: number; published: number; featured: number
}> {
  const [total, exam, direct, published, featured] = await Promise.all([
    db.from('sarkari_naukri').select('id', { count: 'exact', head: true }),
    db.from('sarkari_naukri').select('id', { count: 'exact', head: true }).eq('recruitment_type', 'exam'),
    db.from('sarkari_naukri').select('id', { count: 'exact', head: true }).eq('recruitment_type', 'direct'),
    db.from('sarkari_naukri').select('id', { count: 'exact', head: true }).eq('workflow_status', 'published'),
    db.from('sarkari_naukri').select('id', { count: 'exact', head: true }).eq('is_featured', true),
  ])
  return {
    total: total.count ?? 0,
    exam: exam.count ?? 0,
    direct: direct.count ?? 0,
    published: published.count ?? 0,
    featured: featured.count ?? 0,
  }
}

// ── Facets (for filter dropdowns) ─────────────────────────────────────────────

export async function getStates(): Promise<{ state: string; count: number }[]> {
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('state')
    .eq('workflow_status', 'published')
    .not('state', 'is', null)
  if (error) throw error
  // Aggregate client-side (Supabase doesn't support GROUP BY in select)
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { state: string }[]) {
    counts.set(row.state, (counts.get(row.state) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getCategories(): Promise<{ category: string; count: number }[]> {
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('category')
    .eq('workflow_status', 'published')
    .not('category', 'is', null)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { category: string }[]) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}
