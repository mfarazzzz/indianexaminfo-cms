/**
 * moduleRegistryService.ts — CRUD for the module_registry table.
 *
 * Manages module definitions (both built-in and custom).
 * Built-in modules cannot be deleted. Custom modules can be fully managed.
 */
import { db } from "@/lib/supabase/client";
import type { ModuleDefinition, FieldDefinition } from "@/types/modules";

// ── Row Mapper ─────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ModuleDefinition & { applicablePillars?: string[] } {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    type: row.type as ModuleDefinition["type"],
    icon: (row.icon as string) ?? "",
    description: (row.description as string) ?? "",
    displayOrder: (row.display_order as number) ?? 0,
    fields: (row.fields as FieldDefinition[]) ?? [],
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: (row.created_by as string) ?? null,
    applicablePillars: (row.applicable_pillars as string[]) ?? [],
  };
}

// ── Slug Validation ────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (slug.length > 60) return "Slug must be 60 characters or fewer";
  if (!SLUG_REGEX.test(slug)) return "Slug must be lowercase alphanumeric with hyphens only";
  return null;
}

// ── Service Functions ──────────────────────────────────────────────────────

/**
 * Get all active modules from the registry, ordered by display_order.
 * Optionally filter by pillar (returns modules applicable to that pillar).
 */
export async function getModuleRegistry(pillar?: string): Promise<ModuleDefinition[]> {
  let q = db
    .from("module_registry")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const { data, error } = await q;
  if (error) throw error;

  let modules = (data ?? []).map((r: any) => mapRow(r));

  // Filter by pillar if provided
  if (pillar) {
    modules = modules.filter((m: any) => {
      const applicable = m.applicablePillars as string[] | undefined;
      if (!applicable || applicable.length === 0) return true;
      return applicable.includes(pillar);
    });
  }

  return modules;
}

/**
 * Get all modules (including inactive) for admin management.
 */
export async function getAllModules(): Promise<ModuleDefinition[]> {
  const { data, error } = await db
    .from("module_registry")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r));
}

/**
 * Get a single module by slug.
 */
export async function getModuleBySlug(slug: string): Promise<ModuleDefinition | null> {
  const { data, error } = await db
    .from("module_registry")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Create a new custom module.
 */
export async function createCustomModule(input: {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  fields: FieldDefinition[];
  createdBy?: string;
}): Promise<ModuleDefinition> {
  // Validate slug format
  const slugError = validateSlug(input.slug);
  if (slugError) throw new Error(slugError);

  // Check slug uniqueness
  const existing = await getModuleBySlug(input.slug);
  if (existing) throw new Error(`A module with slug "${input.slug}" already exists.`);

  // Validate field keys are unique within the module
  const keys = input.fields.map((f) => f.key);
  const duplicateKey = keys.find((k, i) => keys.indexOf(k) !== i);
  if (duplicateKey) throw new Error(`Duplicate field key: "${duplicateKey}"`);

  // Get next display order
  const { data: lastModule } = await db
    .from("module_registry")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((lastModule as any)?.display_order ?? 0) + 1;

  const { data, error } = await db
    .from("module_registry")
    .insert({
      slug: input.slug,
      name: input.name,
      type: "custom",
      icon: input.icon ?? "puzzle",
      description: input.description ?? "",
      display_order: nextOrder,
      fields: input.fields,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Update a module definition (works for both built-in and custom).
 * For built-in modules, only name/icon/description/displayOrder/isActive can change.
 * For custom modules, fields can also be updated.
 */
export async function updateModuleDefinition(
  slug: string,
  updates: Partial<{
    name: string;
    icon: string;
    description: string;
    displayOrder: number;
    fields: FieldDefinition[];
    isActive: boolean;
  }>
): Promise<ModuleDefinition> {
  const existing = await getModuleBySlug(slug);
  if (!existing) throw new Error(`Module "${slug}" not found.`);

  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  // Only allow field schema changes for custom modules
  if (updates.fields !== undefined) {
    if (existing.type === "built-in") {
      throw new Error("Cannot modify field schema of built-in modules.");
    }
    // Validate field keys
    const keys = updates.fields.map((f) => f.key);
    const duplicateKey = keys.find((k, i) => keys.indexOf(k) !== i);
    if (duplicateKey) throw new Error(`Duplicate field key: "${duplicateKey}"`);

    dbUpdates.fields = updates.fields;
  }

  const { data, error } = await db
    .from("module_registry")
    .update(dbUpdates)
    .eq("slug", slug)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Delete a custom module from the registry.
 * Rejects if the module is built-in.
 */
export async function deleteCustomModule(slug: string): Promise<void> {
  const existing = await getModuleBySlug(slug);
  if (!existing) throw new Error(`Module "${slug}" not found.`);
  if (existing.type === "built-in") {
    throw new Error("Cannot delete built-in modules.");
  }

  const { error } = await db
    .from("module_registry")
    .delete()
    .eq("slug", slug);

  if (error) throw error;
}

/**
 * Reorder modules by updating display_order based on array position.
 */
export async function reorderModules(orderedSlugs: string[]): Promise<void> {
  // Batch update display_order for each slug
  const updates = orderedSlugs.map((slug, index) => ({
    slug,
    display_order: index + 1,
  }));

  // Execute sequential updates (Supabase doesn't support batch upsert by slug easily)
  for (const { slug, display_order } of updates) {
    const { error } = await db
      .from("module_registry")
      .update({ display_order })
      .eq("slug", slug);

    if (error) throw error;
  }
}

/**
 * Generate a slug from a module name.
 */
export function generateModuleSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
