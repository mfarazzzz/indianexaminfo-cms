/**
 * navigationConfigService.ts — CRUD for the navigation_config table.
 * Used by the CMS Navigation Settings page.
 */
import { db } from "@/lib/supabase/client";

export interface NavConfigItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  pillar: string;
  displayOrder: number;
  isVisible: boolean;
  badge: string | null;
  customLabel: string | null;
  customIcon: string | null;
  featuredExamIds: string[];
  maxItems: number;
  showExamCount: boolean;
}

function mapRow(row: any): NavConfigItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? "",
    categorySlug: row.categories?.slug ?? "",
    pillar: row.categories?.pillar ?? "",
    displayOrder: row.display_order,
    isVisible: row.is_visible,
    badge: row.badge,
    customLabel: row.custom_label,
    customIcon: row.custom_icon,
    featuredExamIds: row.featured_exam_ids ?? [],
    maxItems: row.max_items,
    showExamCount: row.show_exam_count,
  };
}

export async function getNavConfigByPillar(pillar: string): Promise<NavConfigItem[]> {
  const { data, error } = await db
    .from("navigation_config")
    .select("*, categories!inner(name, slug, pillar)")
    .eq("categories.pillar", pillar)
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getAllNavConfig(): Promise<NavConfigItem[]> {
  const { data, error } = await db
    .from("navigation_config")
    .select("*, categories!inner(name, slug, pillar)")
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function updateNavConfig(id: string, updates: Partial<{
  displayOrder: number;
  isVisible: boolean;
  badge: string | null;
  customLabel: string | null;
  customIcon: string | null;
  featuredExamIds: string[];
  maxItems: number;
  showExamCount: boolean;
}>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
  if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;
  if (updates.badge !== undefined) dbUpdates.badge = updates.badge;
  if (updates.customLabel !== undefined) dbUpdates.custom_label = updates.customLabel;
  if (updates.customIcon !== undefined) dbUpdates.custom_icon = updates.customIcon;
  if (updates.featuredExamIds !== undefined) dbUpdates.featured_exam_ids = updates.featuredExamIds;
  if (updates.maxItems !== undefined) dbUpdates.max_items = updates.maxItems;
  if (updates.showExamCount !== undefined) dbUpdates.show_exam_count = updates.showExamCount;

  const { error } = await db.from("navigation_config").update(dbUpdates).eq("id", id);
  if (error) throw error;
}

export async function reorderNavConfig(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.from("navigation_config").update({ display_order: i + 1 }).eq("id", orderedIds[i]);
  }
}
