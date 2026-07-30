/**
 * unifiedContentService.ts — Unified CRUD for the `content_posts` table.
 * Replaces separate contentService + blogService + eduNewsService.
 * Covers ALL content types: exam content, articles, news, blogs.
 */
import { db } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type UnifiedContentType =
  | "notification" | "application" | "admit-card" | "date-sheet"
  | "syllabus" | "answer-key" | "result" | "cutoff"
  | "previous-papers" | "mock-test" | "study-material" | "books"
  | "article" | "news" | "guide" | "opinion" | "blog";

export type UnifiedContentStatus = "draft" | "review" | "published" | "unpublished";

export interface UnifiedContent {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  pillar: string;
  contentType: UnifiedContentType;
  section: string;
  postType: string;
  status: UnifiedContentStatus;
  examId: string;
  examEntityName: string;
  authorId: string;
  authorName: string;
  tags: string[];
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  isBreaking: boolean;
  isPinned: boolean;
  views: number;
  publishedAt: string | null;
  titleHindi: string;
  contentHindi: string;
  source: string;
  sourceLink: string;
  quickLinks: { label: string; url: string; isPDF: boolean; isOfficial: boolean }[];
  importantDates: { label: string; date: string; isUrgent: boolean }[];
  contentTypeData: Record<string, unknown>;
  attachmentUrls: { label: string; url: string; type: string; isOfficial: boolean }[];
  createdAt: string;
  updatedAt: string;
}

// ── Row mapper: snake_case → camelCase ─────────────────────────────────────

function mapRow(row: Record<string, unknown>): UnifiedContent {
  return {
    id: row.id as string,
    slug: (row.slug as string) ?? "",
    title: (row.title as string) ?? "",
    excerpt: (row.excerpt as string) ?? "",
    content: (row.content as string) ?? "",
    pillar: (row.pillar as string) ?? "",
    contentType: (row.content_type as UnifiedContentType) ?? "article",
    section: (row.section as string) ?? "",
    postType: (row.post_type as string) ?? "",
    status: (row.status as UnifiedContentStatus) ?? "draft",
    examId: (row.exam_id as string) ?? "",
    examEntityName: (row.exam_entity_name as string) ?? "",
    authorId: (row.author_id as string) ?? "",
    authorName: (row.author_name as string) ?? "",
    tags: (row.tags as string[]) ?? [],
    faqs: (row.faqs as UnifiedContent["faqs"]) ?? [],
    seoTitle: (row.seo_title as string) ?? "",
    seoDescription: (row.seo_description as string) ?? "",
    isFeatured: (row.is_featured as boolean) ?? false,
    isBreaking: (row.is_breaking as boolean) ?? false,
    isPinned: (row.is_pinned as boolean) ?? false,
    views: (row.views as number) ?? 0,
    publishedAt: (row.published_at as string) ?? null,
    titleHindi: (row.title_hindi as string) ?? "",
    contentHindi: (row.content_hindi as string) ?? "",
    source: (row.source as string) ?? "",
    sourceLink: (row.source_link as string) ?? "",
    quickLinks: (row.quick_links as UnifiedContent["quickLinks"]) ?? [],
    importantDates: (row.important_dates as UnifiedContent["importantDates"]) ?? [],
    contentTypeData: (row.content_type_data as Record<string, unknown>) ?? {},
    attachmentUrls: (row.attachment_urls as UnifiedContent["attachmentUrls"]) ?? [],
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}

// ── Content type groupings for tab filters ─────────────────────────────────

const EXAM_CONTENT_TYPES: UnifiedContentType[] = [
  "notification", "application", "admit-card", "date-sheet",
  "syllabus", "answer-key", "result", "cutoff",
  "previous-papers", "mock-test", "study-material", "books",
];

const ARTICLE_NEWS_TYPES: UnifiedContentType[] = [
  "article", "news", "guide", "opinion", "blog",
];

export { EXAM_CONTENT_TYPES, ARTICLE_NEWS_TYPES };

// ── List with filtering & pagination ───────────────────────────────────────

export interface UnifiedContentListOpts {
  contentType?: UnifiedContentType;
  contentTypeGroup?: "exam" | "articles";
  status?: UnifiedContentStatus;
  examId?: string;
  section?: string;
  search?: string;
  isFeatured?: boolean;
  sortBy?: "updated_at" | "published_at" | "views" | "title";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export async function getUnifiedContentList(opts?: UnifiedContentListOpts): Promise<{ data: UnifiedContent[]; count: number }> {
  const sortCol = opts?.sortBy ?? "updated_at";
  const ascending = opts?.sortDir === "asc";

  let q = db
    .from("content_posts")
    .select("*", { count: "exact" })
    .order(sortCol, { ascending });

  if (opts?.contentType) q = q.eq("content_type", opts.contentType);
  if (opts?.contentTypeGroup === "exam") q = q.in("content_type", EXAM_CONTENT_TYPES);
  if (opts?.contentTypeGroup === "articles") q = q.in("content_type", ARTICLE_NEWS_TYPES);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.examId) q = q.eq("exam_id", opts.examId);
  if (opts?.section) q = q.eq("section", opts.section);
  if (opts?.isFeatured !== undefined) q = q.eq("is_featured", opts.isFeatured);
  if (opts?.search) q = q.ilike("title", `%${opts.search}%`);

  const limit = opts?.limit ?? 25;
  const offset = opts?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map((r: Record<string, unknown>) => mapRow(r)), count: count ?? 0 };
}

// ── Get by ID ──────────────────────────────────────────────────────────────

export async function getUnifiedContentById(id: string): Promise<UnifiedContent | null> {
  const { data, error } = await db.from("content_posts").select("*").eq("id", id).single();
  if (error) return null;
  return mapRow(data as Record<string, unknown>);
}

// ── Create ─────────────────────────────────────────────────────────────────

export interface UnifiedContentCreateInput {
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  pillar?: string;
  contentType: UnifiedContentType;
  section?: string;
  postType?: string;
  status?: UnifiedContentStatus;
  examId?: string;
  examEntityName?: string;
  authorId?: string;
  authorName?: string;
  tags?: string[];
  faqs?: { question: string; answer: string }[];
  seoTitle?: string;
  seoDescription?: string;
  isFeatured?: boolean;
  isBreaking?: boolean;
  isPinned?: boolean;
  titleHindi?: string;
  contentHindi?: string;
  source?: string;
  sourceLink?: string;
  quickLinks?: UnifiedContent["quickLinks"];
  importantDates?: UnifiedContent["importantDates"];
  contentTypeData?: Record<string, unknown>;
  attachmentUrls?: UnifiedContent["attachmentUrls"];
  publishedAt?: string;
}

export async function createUnifiedContent(input: UnifiedContentCreateInput): Promise<UnifiedContent> {
  const status = input.status ?? "draft";
  const publishedAt = status === "published"
    ? (input.publishedAt ?? new Date().toISOString())
    : (input.publishedAt ?? null);

  const { data, error } = await db
    .from("content_posts")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content ? sanitizeHtml(input.content) : null,
      pillar: input.pillar ?? null,
      content_type: input.contentType,
      section: input.section ?? null,
      post_type: input.postType ?? null,
      status,
      exam_id: input.examId || null,
      exam_entity_name: input.examEntityName ?? null,
      author_id: input.authorId || null,
      author_name: input.authorName ?? null,
      tags: input.tags ?? [],
      faqs: input.faqs ?? [],
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      is_featured: input.isFeatured ?? false,
      is_breaking: input.isBreaking ?? false,
      is_pinned: input.isPinned ?? false,
      title_hindi: input.titleHindi ?? null,
      content_hindi: input.contentHindi ?? null,
      source: input.source ?? null,
      source_link: input.sourceLink ?? null,
      quick_links: input.quickLinks ?? [],
      important_dates: input.importantDates ?? [],
      content_type_data: input.contentTypeData ?? {},
      attachment_urls: input.attachmentUrls ?? [],
      published_at: publishedAt,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Update ─────────────────────────────────────────────────────────────────

export interface UnifiedContentUpdateInput {
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  pillar?: string;
  contentType?: UnifiedContentType;
  section?: string;
  postType?: string;
  status?: UnifiedContentStatus;
  examId?: string | null;
  examEntityName?: string;
  authorId?: string | null;
  authorName?: string;
  tags?: string[];
  faqs?: { question: string; answer: string }[];
  seoTitle?: string;
  seoDescription?: string;
  isFeatured?: boolean;
  isBreaking?: boolean;
  isPinned?: boolean;
  titleHindi?: string;
  contentHindi?: string;
  source?: string;
  sourceLink?: string;
  quickLinks?: UnifiedContent["quickLinks"];
  importantDates?: UnifiedContent["importantDates"];
  contentTypeData?: Record<string, unknown>;
  attachmentUrls?: UnifiedContent["attachmentUrls"];
  publishedAt?: string | null;
}

export async function updateUnifiedContent(id: string, input: UnifiedContentUpdateInput): Promise<UnifiedContent> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const fieldMap: Record<string, string> = {
    slug: "slug",
    title: "title",
    excerpt: "excerpt",
    pillar: "pillar",
    contentType: "content_type",
    section: "section",
    postType: "post_type",
    examId: "exam_id",
    examEntityName: "exam_entity_name",
    authorId: "author_id",
    authorName: "author_name",
    tags: "tags",
    faqs: "faqs",
    seoTitle: "seo_title",
    seoDescription: "seo_description",
    isFeatured: "is_featured",
    isBreaking: "is_breaking",
    isPinned: "is_pinned",
    titleHindi: "title_hindi",
    contentHindi: "content_hindi",
    source: "source",
    sourceLink: "source_link",
    quickLinks: "quick_links",
    importantDates: "important_dates",
    contentTypeData: "content_type_data",
    attachmentUrls: "attachment_urls",
    publishedAt: "published_at",
  };

  // UUID fields that must be null instead of empty string
  const UUID_FIELDS = new Set(["exam_id", "author_id"]);

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      let value = (input as Record<string, unknown>)[key];
      if (UUID_FIELDS.has(col) && value === "") value = null;
      updates[col] = value;
    }
  }

  // Sanitize content HTML
  if (input.content !== undefined) {
    updates.content = input.content ? sanitizeHtml(input.content) : null;
  }

  // Auto-set published_at when status becomes "published"
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "published" && !input.publishedAt) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await db
    .from("content_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteUnifiedContent(id: string): Promise<void> {
  const { error } = await db.from("content_posts").delete().eq("id", id);
  if (error) throw error;
}

// ── Publish / Unpublish ────────────────────────────────────────────────────

export async function publishUnifiedContent(id: string): Promise<UnifiedContent> {
  const { data, error } = await db
    .from("content_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function unpublishUnifiedContent(id: string): Promise<UnifiedContent> {
  const { data, error } = await db
    .from("content_posts")
    .update({
      status: "unpublished",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface ContentStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export async function getContentStats(): Promise<ContentStats> {
  // Get total count
  const { count: total } = await db
    .from("content_posts")
    .select("id", { count: "exact", head: true });

  // Get counts by content_type
  const { data: typeRows } = await db
    .from("content_posts")
    .select("content_type");

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  if (typeRows) {
    for (const row of typeRows as Record<string, unknown>[]) {
      const ct = (row.content_type as string) ?? "unknown";
      byType[ct] = (byType[ct] ?? 0) + 1;
    }
  }

  // Get counts by status
  const { data: statusRows } = await db
    .from("content_posts")
    .select("status");

  if (statusRows) {
    for (const row of statusRows as Record<string, unknown>[]) {
      const st = (row.status as string) ?? "unknown";
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }
  }

  return { total: total ?? 0, byType, byStatus };
}
