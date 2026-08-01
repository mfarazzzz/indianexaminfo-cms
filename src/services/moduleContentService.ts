/**
 * moduleContentService.ts — Persistence layer for module content data.
 *
 * All module content is stored in the `exam_editions.content_modules` jsonb column.
 * This service provides methods to read/write individual module content and config
 * without overwriting other modules' data (jsonb merge strategy).
 */
import { db } from "@/lib/supabase/client";
import { revalidateExams } from "@/lib/revalidate";
import type { ModuleConfig, ModuleContentData, ContentModulesData } from "@/types/modules";

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Get the full content_modules object for an edition.
 */
export async function getContentModules(editionId: string): Promise<ContentModulesData> {
  const { data, error } = await db
    .from("exam_editions")
    .select("content_modules")
    .eq("id", editionId)
    .single();

  if (error) throw error;
  return ((data as any)?.content_modules as ContentModulesData) ?? {};
}

/**
 * Get the module config (_config) for an edition.
 */
export async function getModuleConfig(editionId: string): Promise<ModuleConfig> {
  const modules = await getContentModules(editionId);
  return (modules._config as ModuleConfig) ?? { moduleOrder: [], enabledModules: [] };
}

/**
 * Get content data for a specific module within an edition.
 */
export async function getModuleContent(
  editionId: string,
  moduleSlug: string
): Promise<ModuleContentData | null> {
  const modules = await getContentModules(editionId);
  const content = modules[moduleSlug];
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  return content as ModuleContentData;
}

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * Save content for a specific module. Merges into the existing content_modules
 * without overwriting other modules' data.
 *
 * Injects _meta with updatedAt and updatedBy automatically.
 */
export async function saveModuleContent(
  editionId: string,
  moduleSlug: string,
  content: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Build the content with _meta
  const contentWithMeta: ModuleContentData = {
    ...content,
    _meta: {
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    },
  };

  // Read current content_modules, merge, and write back
  // Using jsonb concatenation: content_modules || jsonb_build_object(slug, data)
  const { data: current, error: readErr } = await db
    .from("exam_editions")
    .select("content_modules")
    .eq("id", editionId)
    .single();

  if (readErr) throw readErr;

  const existing = ((current as any)?.content_modules as Record<string, unknown>) ?? {};
  const merged = { ...existing, [moduleSlug]: contentWithMeta };

  const { error: writeErr } = await db
    .from("exam_editions")
    .update({ content_modules: merged })
    .eq("id", editionId);

  if (writeErr) throw writeErr;

  // Option B sync: keep exam_editions.eligibility in sync with content_modules.eligibility
  // This ensures the structured columns (used for Key Highlights) stay current
  if (moduleSlug === "eligibility" && (content.qualification || content.ageLimit || content.nationality)) {
    await db.from("exam_editions").update({
      eligibility: {
        age: (content.ageLimit as string) ?? "",
        qualification: (content.qualification as string) ?? "",
        nationality: (content.nationality as string) ?? "",
      },
    }).eq("id", editionId);
  }

  // Non-blocking cache revalidation
  revalidateExams().catch(() => {});
}

/**
 * Save the module config (order + enablement).
 * Merges into content_modules._config without touching module content.
 */
export async function saveModuleConfig(
  editionId: string,
  config: ModuleConfig
): Promise<void> {
  const { data: current, error: readErr } = await db
    .from("exam_editions")
    .select("content_modules")
    .eq("id", editionId)
    .single();

  if (readErr) throw readErr;

  const existing = ((current as any)?.content_modules as Record<string, unknown>) ?? {};
  const merged = { ...existing, _config: config };

  const { error: writeErr } = await db
    .from("exam_editions")
    .update({ content_modules: merged })
    .eq("id", editionId);

  if (writeErr) throw writeErr;

  // Non-blocking cache revalidation
  revalidateExams().catch(() => {});
}

/**
 * Toggle a module's enabled state in the config.
 */
export async function toggleModuleEnabled(
  editionId: string,
  moduleSlug: string,
  enabled: boolean
): Promise<ModuleConfig> {
  const config = await getModuleConfig(editionId);

  if (enabled && !config.enabledModules.includes(moduleSlug)) {
    config.enabledModules.push(moduleSlug);
  } else if (!enabled) {
    config.enabledModules = config.enabledModules.filter((s) => s !== moduleSlug);
  }

  // Ensure module is in the order array
  if (!config.moduleOrder.includes(moduleSlug)) {
    config.moduleOrder.push(moduleSlug);
  }

  await saveModuleConfig(editionId, config);
  return config;
}

/**
 * Bulk save: save full content_modules object at once.
 * Used during AI generation or initial migration.
 */
export async function saveAllContentModules(
  editionId: string,
  contentModules: ContentModulesData
): Promise<void> {
  const { error } = await db
    .from("exam_editions")
    .update({ content_modules: contentModules })
    .eq("id", editionId);

  if (error) throw error;

  revalidateExams().catch(() => {});
}

/**
 * Remove a module's content from an edition (used when a custom module is deleted).
 */
export async function removeModuleContent(
  editionId: string,
  moduleSlug: string
): Promise<void> {
  const { data: current, error: readErr } = await db
    .from("exam_editions")
    .select("content_modules")
    .eq("id", editionId)
    .single();

  if (readErr) throw readErr;

  const existing = ((current as any)?.content_modules as Record<string, unknown>) ?? {};
  delete existing[moduleSlug];

  // Also remove from config if present
  const config = (existing._config as ModuleConfig) ?? { moduleOrder: [], enabledModules: [] };
  config.moduleOrder = config.moduleOrder.filter((s) => s !== moduleSlug);
  config.enabledModules = config.enabledModules.filter((s) => s !== moduleSlug);
  existing._config = config;

  const { error: writeErr } = await db
    .from("exam_editions")
    .update({ content_modules: existing })
    .eq("id", editionId);

  if (writeErr) throw writeErr;
}
