import { db } from "@/lib/supabase/client";
import type { BlogPost, BlogAuthor, BlogSection, PostType } from "@/types/blog";
import { sanitizeHtml } from "@/lib/utils";

function mapAuthor(row: any): BlogAuthor {
  return {
    id: row.id, slug: row.slug, name: row.name,
    designation: row.designation ?? "", avatar: row.avatar ?? "",
    bio: row.bio ?? "", totalPosts: row.total_posts ?? 0,
    specialization: row.specialization ?? [], socialLinks: row.social_links ?? {},
    isActive: row.is_active, createdAt: row.created_at,
  };
}

function mapPost(row: any): BlogPost {
  return {
    id: row.id, slug: row.slug, title: row.title,
    excerpt: row.excerpt ?? "", content: row.content ?? "",
    section: row.section, postType: row.post_type,
    author: row.blog_authors ? mapAuthor(row.blog_authors) : ({} as BlogAuthor),
    featuredImage: row.featured_image ?? "", featuredImageCaption: row.featured_image_caption ?? "",
    readingTime: row.reading_time ?? 0, wordCount: row.word_count ?? 0,
    views: row.views ?? 0, shares: row.shares ?? 0,
    tags: row.tags ?? [], relatedExamSlugs: row.related_exam_slugs ?? [],
    status: row.status, isFeatured: row.is_featured,
    isBreaking: row.is_breaking, isPinned: row.is_pinned,
    seoTitle: row.seo_title ?? "", seoDescription: row.seo_description ?? "",
    canonicalUrl: row.canonical_url ?? "", tableOfContents: row.table_of_contents ?? [],
    faqs: row.faqs ?? [], publishedAt: row.published_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    createdBy: row.created_by, updatedBy: row.updated_by,
  };
}

export async function getAuthors(): Promise<BlogAuthor[]> {
  const { data, error } = await db.from("blog_authors").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapAuthor);
}

export async function getAuthorById(id: string): Promise<BlogAuthor | null> {
  const { data, error } = await db.from("blog_authors").select("*").eq("id", id).single();
  if (error) return null;
  return mapAuthor(data);
}

export async function createAuthor(input: any): Promise<BlogAuthor> {
  const { data, error } = await db.from("blog_authors").insert({
    slug: input.slug, name: input.name, designation: input.designation ?? null,
    avatar: input.avatar ?? null, bio: input.bio ?? null, total_posts: 0,
    specialization: input.specialization ?? [], social_links: input.socialLinks ?? {},
    is_active: input.isActive ?? true,
  }).select().single();
  if (error) throw error;
  return mapAuthor(data);
}

export async function updateAuthor(id: string, input: any): Promise<BlogAuthor> {
  const updates: Record<string, unknown> = {};
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.name !== undefined) updates.name = input.name;
  if (input.designation !== undefined) updates.designation = input.designation;
  if (input.avatar !== undefined) updates.avatar = input.avatar;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.specialization !== undefined) updates.specialization = input.specialization;
  if (input.socialLinks !== undefined) updates.social_links = input.socialLinks;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  const { data, error } = await db.from("blog_authors").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return mapAuthor(data);
}

export async function deleteAuthor(id: string): Promise<void> {
  const { error } = await db.from("blog_authors").delete().eq("id", id);
  if (error) throw error;
}

export async function getBlogPosts(opts?: {
  section?: BlogSection; postType?: PostType; authorId?: string; status?: string;
  isFeatured?: boolean; search?: string; limit?: number; offset?: number;
}): Promise<{ data: BlogPost[]; count: number }> {
  let q = db.from("blog_posts").select("*, blog_authors(*)", { count: "exact" }).order("updated_at", { ascending: false });
  if (opts?.section) q = q.eq("section", opts.section);
  if (opts?.postType) q = q.eq("post_type", opts.postType);
  if (opts?.authorId) q = q.eq("author_id", opts.authorId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.isFeatured !== undefined) q = q.eq("is_featured", opts.isFeatured);
  if (opts?.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map(mapPost), count: count ?? 0 };
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const { data, error } = await db.from("blog_posts").select("*, blog_authors(*)").eq("id", id).single();
  if (error) return null;
  return mapPost(data);
}

export async function createBlogPost(input: any): Promise<BlogPost> {
  const { data, error } = await db.from("blog_posts").insert({
    slug: input.slug, title: input.title, excerpt: input.excerpt ?? null,
    content: input.content ? sanitizeHtml(input.content) : null, section: input.section,
    post_type: input.postType ?? null, author_id: input.authorId ?? null,
    featured_image: input.featuredImage ?? null, featured_image_caption: input.featuredImageCaption ?? null,
    reading_time: input.readingTime ?? null, word_count: input.wordCount ?? null,
    tags: input.tags ?? [], related_exam_slugs: input.relatedExamSlugs ?? [],
    status: input.status ?? "draft", is_featured: input.isFeatured ?? false,
    is_breaking: input.isBreaking ?? false, is_pinned: input.isPinned ?? false,
    seo_title: input.seoTitle ?? null, seo_description: input.seoDescription ?? null,
    canonical_url: input.canonicalUrl ?? null, table_of_contents: input.tableOfContents ?? [],
    faqs: input.faqs ?? [], published_at: input.status === "published" ? new Date().toISOString() : null,
    created_by: input.createdBy ?? null,
  }).select("*, blog_authors(*)").single();
  if (error) throw error;
  return mapPost(data);
}

export async function updateBlogPost(id: string, input: any): Promise<BlogPost> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fieldMap: Record<string, string> = {
    slug:"slug", title:"title", excerpt:"excerpt", section:"section",
    postType:"post_type", authorId:"author_id", featuredImage:"featured_image",
    featuredImageCaption:"featured_image_caption", readingTime:"reading_time",
    wordCount:"word_count", tags:"tags", relatedExamSlugs:"related_exam_slugs",
    isFeatured:"is_featured", isBreaking:"is_breaking", isPinned:"is_pinned",
    seoTitle:"seo_title", seoDescription:"seo_description", canonicalUrl:"canonical_url",
    tableOfContents:"table_of_contents", faqs:"faqs", updatedBy:"updated_by",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) updates[col] = input[key];
  }
  // Sanitize HTML content separately
  if (input.content !== undefined) updates.content = sanitizeHtml(input.content);
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "published") updates.published_at = new Date().toISOString();
  }
  const { data, error } = await db.from("blog_posts").update(updates).eq("id", id).select("*, blog_authors(*)").single();
  if (error) throw error;
  return mapPost(data);
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await db.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}
