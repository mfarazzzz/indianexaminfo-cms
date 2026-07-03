import { db } from "@/lib/supabase/client";
import type { Pillar } from "@/types/exam";

export type Category = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  pillar: Pillar;
  parentId: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  orderIndex: number;
  isActive: boolean;
  examCount: number;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
};

function mapRow(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    shortName: row.short_name as string | null,
    pillar: row.pillar as Pillar,
    parentId: row.parent_id as string | null,
    description: row.description as string | null,
    icon: row.icon as string | null,
    color: row.color as string | null,
    orderIndex: row.order_index as number,
    isActive: row.is_active as boolean,
    examCount: row.exam_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getCategories(pillar?: Pillar): Promise<Category[]> {
  let q = db.from("categories").select("*").order("order_index");
  if (pillar) q = q.eq("pillar", pillar);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await db.from("categories").select("*").eq("id", id).single();
  if (error) return null;
  return mapRow(data);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await db.from("categories").select("*").eq("slug", slug).single();
  if (error) return null;
  return mapRow(data);
}

export async function createCategory(input: Omit<Category, "id" | "examCount" | "createdAt" | "updatedAt">): Promise<Category> {
  const { data, error } = await db.from("categories").insert({
    slug: input.slug, name: input.name, short_name: input.shortName,
    pillar: input.pillar, parent_id: input.parentId, description: input.description,
    icon: input.icon, color: input.color, order_index: input.orderIndex, is_active: input.isActive,
  }).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateCategory(id: string, input: Partial<Omit<Category, "id" | "createdAt">>): Promise<Category> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.name !== undefined) updates.name = input.name;
  if (input.shortName !== undefined) updates.short_name = input.shortName;
  if (input.pillar !== undefined) updates.pillar = input.pillar;
  if (input.parentId !== undefined) updates.parent_id = input.parentId;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;
  if (input.orderIndex !== undefined) updates.order_index = input.orderIndex;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  const { data, error } = await db.from("categories").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  let q = db.from("categories").select("id").eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).length === 0;
}
