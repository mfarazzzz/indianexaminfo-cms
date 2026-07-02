import { db } from "@/lib/supabase/client";
import type { Menu, MenuItem } from "@/types/menu";

function mapItem(row: any): MenuItem {
  return {
    id: row.id, menuId: row.menu_id, parentId: row.parent_id, label: row.label,
    url: row.url, opensInNewTab: row.opens_in_new_tab, icon: row.icon,
    badge: row.badge, badgeColor: row.badge_color, orderIndex: row.order_index,
    isActive: row.is_active, examId: row.exam_id, categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

export async function getMenus(): Promise<Menu[]> {
  const { data, error } = await db.from("menus").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, slug: r.slug, name: r.name, description: r.description,
    updatedAt: r.updated_at, updatedBy: r.updated_by,
  }));
}

export async function getMenuWithItems(menuId: string): Promise<Menu & { items: MenuItem[] }> {
  const [menuRes, itemsRes] = await Promise.all([
    db.from("menus").select("*").eq("id", menuId).single(),
    db.from("menu_items").select("*").eq("menu_id", menuId).order("order_index"),
  ]);
  if (menuRes.error) throw menuRes.error;
  const r = menuRes.data as any;
  return {
    id: r.id, slug: r.slug, name: r.name, description: r.description,
    updatedAt: r.updated_at, updatedBy: r.updated_by,
    items: (itemsRes.data ?? []).map(mapItem),
  };
}

export async function saveMenuItems(menuId: string, items: Omit<MenuItem, "createdAt">[], userId?: string): Promise<void> {
  await db.from("menu_items").delete().eq("menu_id", menuId);
  if (items.length > 0) {
    const { error } = await db.from("menu_items").insert(
      items.map((item) => ({
        id: item.id, menu_id: menuId, parent_id: item.parentId ?? null,
        label: item.label, url: item.url ?? null, opens_in_new_tab: item.opensInNewTab,
        icon: item.icon ?? null, badge: item.badge ?? null, badge_color: item.badgeColor ?? null,
        order_index: item.orderIndex, is_active: item.isActive,
        exam_id: item.examId ?? null, category_id: item.categoryId ?? null,
      }))
    );
    if (error) throw error;
  }
  await db.from("menus").update({ updated_at: new Date().toISOString(), updated_by: userId ?? null }).eq("id", menuId);
}
