import { db } from "@/lib/supabase/client";
import type { ContentPost, ContentType } from "@/types/exam";
import { sanitizeHtml } from "@/lib/utils";

export type { ContentPost };

function mapRow(row: Record<string, unknown>): ContentPost {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: (row.excerpt as string) ?? "",
    content: (row.content as string) ?? "",
    examEntityId: (row.exam_id as string) ?? "",
    examEntityName: (row.exam_entity_name as string) ?? "",
    pillar: row.pillar as ContentPost['pillar'],
    contentType: row.content_type as ContentType,
    quickLinks: (row.quick_links as ContentPost["quickLinks"]) ?? [],
    importantDates: (row.important_dates as ContentPost["importantDates"]) ?? [],
    contentTypeData: (row.content_type_data as Record<string, unknown>) ?? {},
    attachmentUrls: (row.attachment_urls as ContentPost["attachmentUrls"]) ?? [],
    featuredImage: row.featured_image as string | undefined,
    tags: (row.tags as string[]) ?? [],
    status: row.status as ContentPost["status"],
    isFeatured: row.is_featured as boolean,
    views: (row.views as number) ?? 0,
    seoTitle: (row.seo_title as string) ?? "",
    seoDescription: (row.seo_description as string) ?? "",
    faqs: (row.faqs as ContentPost["faqs"]) ?? [],
    publishedAt: row.published_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
    updatedBy: row.updated_by as string | undefined,
  };
}

export async function getContentPosts(opts?: {
  examId?: string; contentType?: ContentType; pillar?: string; status?: string;
  search?: string; isFeatured?: boolean; limit?: number; offset?: number;
}): Promise<{ data: ContentPost[]; count: number }> {
  let q = db.from("content_posts").select("*", { count: "exact" }).order("updated_at", { ascending: false });
  if (opts?.examId) q = q.eq("exam_id", opts.examId);
  if (opts?.contentType) q = q.eq("content_type", opts.contentType);
  if (opts?.pillar) q = q.eq("pillar", opts.pillar);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.isFeatured !== undefined) q = q.eq("is_featured", opts.isFeatured);
  if (opts?.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 };
}

export async function getContentPostById(id: string): Promise<ContentPost | null> {
  const { data, error } = await db.from("content_posts").select("*").eq("id", id).single();
  if (error) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function createContentPost(input: any): Promise<ContentPost> {
  const { data, error } = await db.from("content_posts").insert({
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt ?? null,
    content: input.content ? sanitizeHtml(input.content) : null,
    exam_id: input.examId ?? null,
    exam_entity_name: input.examEntityName ?? null,
    pillar: input.pillar,
    content_type: input.contentType,
    quick_links: input.quickLinks ?? [],
    important_dates: input.importantDates ?? [],
    content_type_data: input.contentTypeData ?? {},
    attachment_urls: input.attachmentUrls ?? [],
    featured_image: input.featuredImage ?? null,
    tags: input.tags ?? [],
    status: input.status ?? "draft",
    is_featured: input.isFeatured ?? false,
    seo_title: input.seoTitle ?? null,
    seo_description: input.seoDescription ?? null,
    faqs: input.faqs ?? [],
    published_at: input.status === "published" ? new Date().toISOString() : null,
    created_by: input.createdBy ?? null,
  }).select().single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateContentPost(id: string, input: any): Promise<ContentPost> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fieldMap: Record<string, string> = {
    slug:            "slug",
    title:           "title",
    excerpt:         "excerpt",
    examId:          "exam_id",
    examEntityName:  "exam_entity_name",
    pillar:          "pillar",
    contentType:     "content_type",
    quickLinks:      "quick_links",
    importantDates:  "important_dates",
    contentTypeData: "content_type_data",
    attachmentUrls:  "attachment_urls",
    featuredImage:   "featured_image",
    tags:            "tags",
    isFeatured:      "is_featured",
    seoTitle:        "seo_title",
    seoDescription:  "seo_description",
    faqs:            "faqs",
    updatedBy:       "updated_by",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) updates[col] = input[key];
  }
  if (input.content !== undefined) updates.content = sanitizeHtml(input.content);
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "published") updates.published_at = new Date().toISOString();
  }
  const { data, error } = await db.from("content_posts").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteContentPost(id: string): Promise<void> {
  const { error } = await db.from("content_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function getReviewCount(): Promise<number> {
  const { count } = await db.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "review");
  return count ?? 0;
}
