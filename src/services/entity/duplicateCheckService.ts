/**
 * duplicateCheckService.ts — Fuzzy duplicate entity detection via pg_trgm.
 * Calls the check_duplicate_entity Postgres function (Req 5.1, 5.2).
 */
import { db } from '@/lib/supabase/client'

export interface DuplicateMatch {
  id: string
  name: string
  slug: string
  workflowStatus: string
  conductingBodyId: string | null
  conductingBodyName: string | null
  updatedAt: string
  updatedByName: string | null
  similarityScore: number
}

/**
 * Check for existing entities that fuzzy-match the given name.
 * Returns up to 5 matches above the threshold (default 0.7).
 */
export async function checkDuplicateEntity(
  name: string,
  conductingBodyId: string | null,
  threshold = 0.7
): Promise<DuplicateMatch[]> {
  const { data, error } = await db.rpc('check_duplicate_entity', {
    p_name: name,
    p_conducting_body_id: conductingBodyId,
    p_threshold: threshold,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    workflowStatus: row.workflow_status as string,
    conductingBodyId: row.conducting_body_id as string | null,
    conductingBodyName: row.conducting_body_name as string | null,
    updatedAt: row.updated_at as string,
    updatedByName: row.updated_by_name as string | null,
    similarityScore: row.similarity_score as number,
  }))
}
