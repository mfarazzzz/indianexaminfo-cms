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

/**
 * Map of setting keys → their group and label (for upsert when row doesn't exist).
 *
 * No API key belongs in this list. Provider keys used to be stored as ordinary
 * settings rows and read by the browser; they are now Edge Function secrets
 * (`AI_KEY_GROQ` …) that only the `ai-fill` function can see, so there is nothing
 * here for the app to write.
 */
const SETTING_META: Record<string, { group: SettingGroup; label: string; is_sensitive?: boolean }> = {
  ai_enabled:          { group: "ai", label: "Enable AI Features" },
  ai_auto_seo:         { group: "ai", label: "Auto-generate SEO" },
  ai_auto_summary:     { group: "ai", label: "Auto-generate Summary Box" },
  ai_auto_faq:         { group: "ai", label: "Auto-generate FAQs" },
  ai_language:         { group: "ai", label: "Content Language" },
  ai_tone:             { group: "ai", label: "Writing Tone" },
  site_name:           { group: "general", label: "Site Name" },
  site_tagline:        { group: "general", label: "Site Tagline" },
  site_url:            { group: "general", label: "Frontend URL" },
  contact_email:       { group: "general", label: "Contact Email" },
  whatsapp_number:     { group: "general", label: "WhatsApp Number" },
  telegram_channel:    { group: "general", label: "Telegram Channel" },
  youtube_channel:     { group: "general", label: "YouTube Channel" },
  posts_per_page:      { group: "general", label: "Posts Per Page" },
  supabase_url:        { group: "database", label: "Supabase URL" },
  supabase_anon_key:   { group: "database", label: "Supabase Anon Key", is_sensitive: true },
  db_status:           { group: "database", label: "DB Status" },
  frontend_url:        { group: "integrations", label: "Frontend Base URL" },
  // revalidate_token removed from the settings registry (S0-1 follow-up): the
  // token is an Edge Function secret only, never stored or edited as a setting.
  revalidate_on_publish:{ group: "integrations", label: "Auto-Revalidate on Publish" },
};

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
  // Use upsert: if the setting row doesn't exist yet, insert it; otherwise update.
  const meta = SETTING_META[key] || { group: "general" as SettingGroup, label: key.replace(/_/g, " ") };
  const { data, error } = await db.from("settings").upsert({
    key,
    value,
    group: meta.group,
    label: meta.label,
    is_sensitive: meta.is_sensitive ?? false,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  }, { onConflict: "key" }).select().single();
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
