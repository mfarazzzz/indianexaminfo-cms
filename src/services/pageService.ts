import { db } from "@/lib/supabase/client";
import type { Page } from "@/types/page";

function mapRow(row: any): Page {
  return {
    id: row.id, slug: row.slug, title: row.title, content: row.content,
    metaTitle: row.meta_title, metaDescription: row.meta_description,
    isSystem: row.is_system, status: row.status, orderIndex: row.order_index,
    createdAt: row.created_at, updatedAt: row.updated_at, updatedBy: row.updated_by,
  };
}

export async function getPages(): Promise<Page[]> {
  const { data, error } = await db.from("pages").select("*").order("order_index");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getPageById(id: string): Promise<Page | null> {
  const { data, error } = await db.from("pages").select("*").eq("id", id).single();
  if (error) return null;
  return mapRow(data);
}

export async function createPage(input: Partial<Page>): Promise<Page> {
  const { data, error } = await db.from("pages").insert({
    slug: input.slug, title: input.title, content: input.content ?? null,
    meta_title: input.metaTitle ?? null, meta_description: input.metaDescription ?? null,
    is_system: input.isSystem ?? false, status: input.status ?? "draft",
    order_index: input.orderIndex ?? 0,
  }).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function updatePage(id: string, input: Partial<Page>, userId?: string): Promise<Page> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: userId ?? null };
  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.metaTitle !== undefined) updates.meta_title = input.metaTitle;
  if (input.metaDescription !== undefined) updates.meta_description = input.metaDescription;
  if (input.status !== undefined) updates.status = input.status;
  if (input.orderIndex !== undefined) updates.order_index = input.orderIndex;
  const { data, error } = await db.from("pages").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function deletePage(id: string): Promise<void> {
  const page = await getPageById(id);
  if (page?.isSystem) throw new Error("Cannot delete a system page.");
  const { error } = await db.from("pages").delete().eq("id", id);
  if (error) throw error;
}
