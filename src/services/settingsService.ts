import { db } from "@/lib/supabase/client";
import type { Setting, SettingGroup } from "@/types/settings";

function mapRow(row: any): Setting {
  return {
    id: row.id, key: row.key, value: row.value,
    group: row.group as SettingGroup, label: row.label,
    description: row.description, isSensitive: row.is_sensitive,
    updatedAt: row.updated_at, updatedBy: row.updated_by,
  };
}

export async function getAllSettings(): Promise<Setting[]> {
  const { data, error } = await db.from("settings").select("*").order("group");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getSettingsByGroup(group: SettingGroup): Promise<Setting[]> {
  const { data, error } = await db.from("settings").select("*").eq("group", group);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function updateSetting(key: string, value: unknown, userId?: string): Promise<Setting> {
  const { data, error } = await db.from("settings").update({
    value, updated_at: new Date().toISOString(), updated_by: userId ?? null,
  }).eq("key", key).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateSettingsBulk(updates: { key: string; value: unknown }[], userId?: string): Promise<void> {
  for (const { key, value } of updates) {
    await updateSetting(key, value, userId);
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{
  connected: boolean; examCount?: number; error?: string;
}> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, anonKey) as any;
    const { count, error } = await client.from("exams").select("id", { count: "exact", head: true });
    if (error) return { connected: false, error: error.message };
    return { connected: true, examCount: count ?? 0 };
  } catch (err) {
    return { connected: false, error: String(err) };
  }
}
