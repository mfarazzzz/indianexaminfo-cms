import { db } from '@/lib/supabase/client'
import type { EntityExamPattern } from '@/types/entity'
import type { ExamPatternStageInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityExamPattern {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    stageName: r.stage_name as string,
    durationMinutes: r.duration_minutes as number | null,
    totalQuestions: r.total_questions as number | null,
    totalMarks: r.total_marks as number | null,
    negativeMarking: r.negative_marking as number | null,
    subjects: (r.subjects as string[]) ?? [],
    examLanguage: r.exam_language as string | null,
    qualifyingMarks: r.qualifying_marks as string | null,
    notes: r.notes as string | null,
    displayOrder: (r.display_order as number) ?? 0,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listExamPattern(
  entityId: string
): Promise<EntityExamPattern[]> {
  const { data, error } = await db
    .from('entity_exam_pattern')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createPatternStage(
  entityId: string,
  input: ExamPatternStageInput
): Promise<EntityExamPattern> {
  const { data, error } = await db
    .from('entity_exam_pattern')
    .insert({
      entity_id: entityId,
      stage_name: input.stageName,
      duration_minutes: input.durationMinutes ?? null,
      total_questions: input.totalQuestions ?? null,
      total_marks: input.totalMarks ?? null,
      negative_marking: input.negativeMarking ?? null,
      subjects: input.subjects ?? [],
      exam_language: input.examLanguage ?? null,
      qualifying_marks: input.qualifyingMarks ?? null,
      notes: input.notes ?? null,
      display_order: input.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updatePatternStage(
  id: string,
  input: Partial<ExamPatternStageInput>
): Promise<void> {
  const updates: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    stageName: 'stage_name',
    durationMinutes: 'duration_minutes',
    totalQuestions: 'total_questions',
    totalMarks: 'total_marks',
    negativeMarking: 'negative_marking',
    subjects: 'subjects',
    examLanguage: 'exam_language',
    qualifyingMarks: 'qualifying_marks',
    notes: 'notes',
    displayOrder: 'display_order',
  }
  for (const [k, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  }
  const { error } = await db
    .from('entity_exam_pattern')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function softDeletePatternStage(id: string): Promise<void> {
  const { error } = await db
    .from('entity_exam_pattern')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reorderPatternStages(
  entityId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .from('entity_exam_pattern')
        .update({ display_order: i })
        .eq('id', id)
        .eq('entity_id', entityId)
    )
  )
}
