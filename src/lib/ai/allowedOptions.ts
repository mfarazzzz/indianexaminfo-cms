/**
 * allowedOptions.ts — S2.1: read the dropdown vocabulary AT CALL TIME.
 *
 * Until now the AI prompts HARD-CODED the choices they were allowed to pick
 * (autofill.ts listed category slugs and an entityType enum that had already
 * drifted from the DB and the registry — §15.1 of the design doc). That is how
 * "teaching-and-education" could never be chosen even after the category
 * existed, and a stale "university" enum kept proposing values the schema no
 * longer accepts.
 *
 * One loader, used by every extraction path (the browser today, the ai-fill
 * Edge Function's server-side templates from S2.3 — Deno port lives beside the
 * function and reads the SAME tables):
 *   • categories — the `categories` table, filtered by pillar (slug+name);
 *   • regions    — the `regions` table via regionService;
 *   • entityType — the moduleRegistry axis-1 vocabulary, narrowed to the
 *                  pillar's legal choices via entityTypeForPillar (the same
 *                  authority the editors and Excel import use);
 *   • selectionModel — types/selection ALL_SELECTION_MODELS.
 */
import { getCategories } from "@/services/categoryService";
import { getRegions } from "@/services/regionService";
import { ALL_ENTITY_TYPES, entityTypeForPillar, ENTRANCE_EXAM_ENTITY_CHOICES } from "@/config/moduleRegistry";
import { ALL_SELECTION_MODELS } from "@/types/selection";
import type { AllowedOptions } from "@/lib/ai/extractionContract";

/** The entity types the pillar legally allows (entrance-exam: a real choice). */
export function entityTypesForPillar(pillar?: string): string[] {
  const fixed = pillar ? entityTypeForPillar(pillar) : null;
  if (fixed) return [fixed];
  if (pillar === "entrance-exam") return [...ENTRANCE_EXAM_ENTITY_CHOICES];
  return [...ALL_ENTITY_TYPES];
}

/**
 * Load the allowed options for one extraction call. Categories are filtered by
 * pillar when a pillar is known — a teaching admission must see teaching
 * categories, not the whole platform list. Safe to await on every call: these
 * reads sit behind React Query caches elsewhere and are small tables.
 */
export async function loadAllowedOptions(pillar?: string): Promise<AllowedOptions> {
  const [categories, regions] = await Promise.all([
    getCategories(pillar).catch(() => []),
    getRegions().catch(() => []),
  ]);
  return {
    categories: categories
      .filter((c) => c.isActive)
      .map((c) => ({ slug: c.slug, name: c.name })),
    regions: regions.map((r) => ({ slug: r.slug, label: r.label })),
    entityTypes: entityTypesForPillar(pillar),
    selectionModels: [...ALL_SELECTION_MODELS],
  };
}

/** Compact, prompt-safe rendering of the allowed lists (value — label). */
export function formatOptionsForPrompt(allowed: AllowedOptions): string {
  const cats = allowed.categories.map((c) => `"${c.slug}" (${c.name})`).join(", ") || "(none)";
  const regs = allowed.regions.map((r) => `"${r.slug}"`).join(", ") || "(none)";
  return [
    `categorySlug MUST be one of: ${cats}`,
    `region MUST be one of: ${regs}`,
    `entityType MUST be one of: ${allowed.entityTypes.map((t) => `"${t}"`).join(", ") || "(none)"}`,
    `selectionModel MUST be one of: ${allowed.selectionModels.map((m) => `"${m}"`).join(", ")}`,
    "If the right value is NOT in the list, return the closest new name in \"suggestedNewOption\" and a LOW confidence — never invent a slug that exists.",
  ].join("\n");
}
