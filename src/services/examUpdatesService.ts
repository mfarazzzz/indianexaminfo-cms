/**
 * examUpdatesService.ts — D-P2 (Option D): a per-exam "Updates" feed authored as
 * content_posts rows. An update is a content_post linked to an exam (+ edition),
 * carrying a `kind`, an optional `expires_at`, a `display_order` for the reader
 * list, and a `supersedes_id` for a provisional→final / revised / corrigendum
 * chain. Decisions locked in docs/design/content-posts-as-updates.md.
 *
 * Ownership stays clean: an update NEVER drives lifecycle status (that is
 * important_dates + exam_derived_status). It is the announcement layer only.
 *
 * Persistence is content_posts; the columns kind / supersedes_id / expires_at /
 * display_order / verified_by / is_pinned / exam_edition_id exist (D-P1 applied
 * as 20261013125113). RLS already gates writes: create_post to author a draft,
 * publish_post additionally to publish, edit_any_post to edit any exam's update.
 */
import { db } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/utils";
import type { ContentType } from "@/types/exam";

export type UpdateKind = "provisional" | "final" | "revised" | "corrigendum" | "withdrawn";
export const UPDATE_KINDS: UpdateKind[] = ["provisional", "final", "revised", "corrigendum", "withdrawn"];

export interface UpdateLink { label: string; url: string }
export interface ExamUpdate {
  id: string;
  examId: string;
  examEditionId: string | null;
  contentType: ContentType;
  title: string;
  body: string;
  kind: UpdateKind;
  displayOrder: number;
  expiresAt: string | null;
  supersedesId: string | null;
  isPinned: boolean;
  status: "draft" | "review" | "published" | "unpublished";
  quickLinks: UpdateLink[];
  attachmentUrls: UpdateLink[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, any>): ExamUpdate {
  return {
    id: row.id,
    examId: row.exam_id ?? "",
    examEditionId: row.exam_edition_id ?? null,
    contentType: row.content_type,
    title: row.title ?? "",
    body: row.content ?? "",
    kind: (UPDATE_KINDS.includes(row.kind) ? row.kind : "provisional") as UpdateKind,
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    expiresAt: row.expires_at ?? null,
    supersedesId: row.supersedes_id ?? null,
    isPinned: Boolean(row.is_pinned),
    status: row.status,
    quickLinks: Array.isArray(row.quick_links) ? row.quick_links : [],
    attachmentUrls: Array.isArray(row.attachment_urls) ? row.attachment_urls : [],
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Keep only links with BOTH a label and a url; a label with no address is a
 *  note, not a link — never a broken anchor. De-dupes by url. */
export function sanitizeLinks(links: unknown): UpdateLink[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const out: UpdateLink[] = [];
  for (const l of links) {
    if (!l || typeof l !== "object") continue;
    const label = String((l as any).label ?? "").trim();
    const url = String((l as any).url ?? "").trim();
    if (!label || !url) continue;
    if (/^\s*(javascript|data|vbscript):/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label, url });
  }
  return out;
}

export interface NewExamUpdate {
  examId: string;
  examEditionId?: string | null;
  contentType: ContentType;
  title: string;
  body?: string;
  kind?: UpdateKind;
  displayOrder?: number;
  expiresAt?: string | null;
  supersedesId?: string | null;
  isPinned?: boolean;
  quickLinks?: UpdateLink[];
  attachmentUrls?: UpdateLink[];
  status?: ExamUpdate["status"];
  pillar?: string;
  slug: string;
  createdBy?: string;
}

/** Create an exam update as a content_post. Defaults to a DRAFT (never silently
 *  published — publishing needs publish_post and an explicit editor action). */
export async function createExamUpdate(input: NewExamUpdate): Promise<ExamUpdate> {
  const status = input.status ?? "draft";
  const { data, error } = await db.from("content_posts").insert({
    slug: input.slug,
    title: input.title,
    content: input.body ? sanitizeHtml(input.body) : null,
    exam_id: input.examId,
    exam_edition_id: input.examEditionId ?? null,
    pillar: input.pillar ?? "government-exam",
    content_type: input.contentType,
    kind: input.kind ?? "provisional",
    display_order: input.displayOrder ?? 0,
    expires_at: input.expiresAt ?? null,
    supersedes_id: input.supersedesId ?? null,
    is_pinned: input.isPinned ?? false,
    quick_links: sanitizeLinks(input.quickLinks),
    attachment_urls: sanitizeLinks(input.attachmentUrls),
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
    created_by: input.createdBy ?? null,
  }).select().single();
  if (error) throw error;
  return mapRow(data as Record<string, any>);
}

export async function listExamUpdates(examId: string): Promise<ExamUpdate[]> {
  const { data, error } = await db
    .from("content_posts")
    .select("*")
    .eq("exam_id", examId)
    .order("display_order", { ascending: true })
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r));
}

export type ExamUpdatePatch = Partial<Omit<NewExamUpdate, "examId" | "slug">>;

export async function updateExamUpdate(id: string, patch: ExamUpdatePatch): Promise<ExamUpdate> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.body !== undefined) updates.content = patch.body ? sanitizeHtml(patch.body) : null;
  if (patch.contentType !== undefined) updates.content_type = patch.contentType;
  if (patch.kind !== undefined) updates.kind = patch.kind;
  if (patch.displayOrder !== undefined) updates.display_order = patch.displayOrder;
  if (patch.expiresAt !== undefined) updates.expires_at = patch.expiresAt;
  if (patch.supersedesId !== undefined) updates.supersedes_id = patch.supersedesId;
  if (patch.isPinned !== undefined) updates.is_pinned = patch.isPinned;
  if (patch.examEditionId !== undefined) updates.exam_edition_id = patch.examEditionId;
  if (patch.quickLinks !== undefined) updates.quick_links = sanitizeLinks(patch.quickLinks);
  if (patch.attachmentUrls !== undefined) updates.attachment_urls = sanitizeLinks(patch.attachmentUrls);
  if (patch.status !== undefined) {
    updates.status = patch.status;
    if (patch.status === "published") updates.published_at = new Date().toISOString();
  }
  const { data, error } = await db.from("content_posts").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data as Record<string, any>);
}

/** Withdraw = kind 'withdrawn'; the post stays published so readers still see
 *  the history. A full hide is status 'unpublished' (a different action). */
export async function withdrawExamUpdate(id: string): Promise<ExamUpdate> {
  return updateExamUpdate(id, { kind: "withdrawn" });
}

/** Set the supersession edge on the NEW update (points at the row it replaces).
 *  The DB trigger content_posts_supersedes_same_exam keeps both on one exam. */
export async function supersedeExamUpdate(supersedingId: string, supersededId: string): Promise<ExamUpdate> {
  return updateExamUpdate(supersedingId, { supersedesId: supersededId });
}

/** Persist a reader-facing order: ids are written display_order 0..n in the
 *  given sequence. One update per row; a failed write throws. */
export async function reorderExamUpdates(examId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db.from("content_posts").update({ display_order: i }).eq("id", orderedIds[i]).eq("exam_id", examId);
    if (error) throw error;
  }
}
