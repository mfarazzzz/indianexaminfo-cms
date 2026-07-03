import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, GripVertical, ChevronRight } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getMenus, getMenuWithItems, saveMenuItems } from "@/services/menuService";
import { revalidateMenus } from "@/lib/api/frontend";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { SITE } from "@/config/site";
import type { Menu, MenuItem } from "@/types/menu";

function SortableItem({ item, onEdit, onDelete }: { item: MenuItem; onEdit: (item: MenuItem) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 rounded border border-slate-200 bg-white p-2 ${item.parentId ? "ml-6" : ""}`}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500">
        <GripVertical size={14} />
      </button>
      <span className="flex-1 text-sm text-slate-700">{item.label}</span>
      {item.url && <span className="max-w-32 truncate text-xs text-slate-400">{item.url}</span>}
      <div className={`h-2 w-2 rounded-full ${item.isActive ? "bg-green-400" : "bg-slate-200"}`} />
      <button type="button" onClick={() => onEdit(item)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-xs">Edit</button>
      <button type="button" onClick={() => onDelete(item.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
    </div>
  );
}

export function MenusPage() {
  const { getSetting } = useSettings();
  const { user } = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);

  const [itemLabel, setItemLabel] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemNewTab, setItemNewTab] = useState(false);
  const [itemActive, setItemActive] = useState(true);
  const [itemBadge, setItemBadge] = useState("");
  const [itemIcon, setItemIcon] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    getMenus()
      .then((m) => { setMenus(m); if (m.length > 0) setSelected(m[0].id); })
      .catch((err) => toast.error("Failed to load menus: " + String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    getMenuWithItems(selected)
      .then((m) => setItems(m.items || []))
      .catch((err) => toast.error("Failed to load menu items: " + String(err)));
  }, [selected]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over!.id);
      setItems(arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, orderIndex: idx })));
    }
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemLabel(""); setItemUrl(""); setItemNewTab(false); setItemActive(true); setItemBadge(""); setItemIcon("");
    setShowItemForm(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemLabel(item.label); setItemUrl(item.url ?? ""); setItemNewTab(item.opensInNewTab);
    setItemActive(item.isActive); setItemBadge(item.badge ?? ""); setItemIcon(item.icon ?? "");
    setShowItemForm(true);
  };

  const saveItem = () => {
    if (!itemLabel.trim()) return;
    if (editingItem) {
      setItems(items.map((i) => i.id === editingItem.id ? {
        ...i, label: itemLabel, url: itemUrl || null, opensInNewTab: itemNewTab,
        isActive: itemActive, badge: itemBadge || null, icon: itemIcon || null,
      } : i));
    } else {
      const newItem: MenuItem = {
        id: `new-${Date.now()}`, menuId: selected!, parentId: null, label: itemLabel,
        url: itemUrl || null, opensInNewTab: itemNewTab, icon: itemIcon || null,
        badge: itemBadge || null, badgeColor: null, orderIndex: items.length,
        isActive: itemActive, examId: null, categoryId: null, createdAt: new Date().toISOString(),
      };
      setItems([...items, newItem]);
    }
    setShowItemForm(false);
  };

  const deleteItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveMenuItems(selected, items, user?.id);
      toast.success("Menu saved. Revalidating…");
      const url = getSetting("frontend_url", SITE.frontendUrl) as string;
      const token = getSetting("revalidate_token", "") as string;
      if (token) await revalidateMenus(url, token);
      toast.success("Frontend updated.");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  return (
    <div className="flex gap-6">
      {/* Menu list */}
      <div className="w-56 shrink-0">
        <h1 className="mb-3 text-xl font-semibold text-slate-900">Menu Manager</h1>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {menus.map((menu) => (
            <button key={menu.id} onClick={() => setSelected(menu.id)}
              className={`flex w-full items-center justify-between px-4 py-3 text-sm transition-colors border-b border-slate-100 last:border-0 ${selected === menu.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}>
              {menu.name}
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Menu editor */}
      <div className="flex-1 space-y-4">
        {selected && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {menus.find((m) => m.id === selected)?.name}
              </h2>
              <div className="flex gap-2">
                <button onClick={openNewItem}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <Plus size={14} /> Add Item
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Menu
                </button>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {items.map((item) => (
                    <SortableItem key={item.id} item={item} onEdit={openEditItem} onDelete={deleteItem} />
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                      No items yet. Add one to get started.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      {/* Item edit panel */}
      {showItemForm && (
        <div className="w-72 shrink-0 rounded-lg border border-slate-200 bg-white p-4 space-y-3 h-fit sticky top-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingItem ? "Edit Item" : "New Item"}</h3>
            <button onClick={() => setShowItemForm(false)} className="text-slate-400 hover:text-slate-700">×</button>
          </div>
          <div>
            <label className="form-label text-xs">Label *</label>
            <input value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="form-label text-xs">URL</label>
            <input value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="/path or https://..." />
          </div>
          <div>
            <label className="form-label text-xs">Icon (emoji)</label>
            <input value={itemIcon} onChange={(e) => setItemIcon(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="form-label text-xs">Badge Text</label>
            <input value={itemBadge} onChange={(e) => setItemBadge(e.target.value)} placeholder="NEW, HOT…" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={itemNewTab} onChange={(e) => setItemNewTab(e.target.checked)} className="h-4 w-4 rounded" /> New tab
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={itemActive} onChange={(e) => setItemActive(e.target.checked)} className="h-4 w-4 rounded" /> Active
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowItemForm(false)} className="flex-1 rounded border border-slate-200 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={saveItem} className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">{editingItem ? "Update" : "Add"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
