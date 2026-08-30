/**
 * activityLogService.ts — Activity logging for module state transitions.
 * Supports dashboard feed (Req 8.1–8.7) and module_filled/module_updated tracking.
 */
import { db } from '@/lib/supabase/client'
import type { DashboardActivityEntry } from '@/types/entity'

/**
 * Log a module activity event (module_filled or module_updated).
 * Called from moduleService after block CRUD operations.
 */
export async function logModuleActivity(
  entityId: string,
  moduleId: string,
  moduleType: string,
  actorId: string,
  action: 'module_filled' | 'module_updated'
): Promise<void> {
  const { error } = await db
    .from('entity_activity_log')
    .insert({
      entity_id: entityId,
      module_id: moduleId,
      actor_id: actorId,
      action,
      target_type: moduleType,
    })
  if (error) throw error
}

/**
 * Fetch recent activity feed entries for the dashboard.
 * Resolves entity name and actor name via joins.
 */
export async function listRecentActivity(
  limit = 25
): Promise<DashboardActivityEntry[]> {
  // NOTE: actor_id FKs to auth.users, which PostgREST cannot embed (not in the
  // exposed `public` schema, and has no `name` column) — embedding it returned
  // HTTP 400 and killed the whole query. Resolve the actor name separately from
  // public.user_profiles instead. entity_id → public.entity embeds fine.
  const { data, error } = await db
    .from('entity_activity_log')
    .select(`
      id, entity_id, module_id, actor_id, action, target_type, created_at,
      entity:entity_id ( name )
    `)
    .in('action', ['module_filled', 'module_updated'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = data ?? []

  // Resolve actor names from user_profiles (public schema, embeddable-free lookup)
  const actorIds = [...new Set(rows.map((r: Record<string, unknown>) => r.actor_id as string).filter(Boolean))]
  const actorNames = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await db
      .from('user_profiles')
      .select('id, name')
      .in('id', actorIds)
    for (const p of profiles ?? []) actorNames.set((p as any).id, (p as any).name)
  }

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    entityId: row.entity_id as string,
    entityName: (row as any).entity?.name ?? 'Unknown',
    moduleId: row.module_id as string | null,
    moduleType: row.target_type as string,
    actorId: row.actor_id as string,
    actorName: actorNames.get(row.actor_id as string) ?? 'Unknown',
    action: row.action as 'module_filled' | 'module_updated',
    createdAt: row.created_at as string,
  }))
}
