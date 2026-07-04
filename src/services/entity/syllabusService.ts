import { db } from '@/lib/supabase/client'
import type { EntitySyllabusSubject } from '@/types/entity'
import type { SyllabusSubjectInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntitySyllabusSubject {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    subjectName: r.subject_name as string,
    topics: (r.topics as string[]) ?? [],
    description: r.description as string | null,
    pdfUrl: r.pdf_url as string | null,
    videoLink: r.video_link as string | null,
    studyNotes: r.study_notes as string | null,
    books: r.books as string | null,
    weightagePercent: r.weightage_percent as number | null,
    displayOrder: (r.display_order as number) ?? 0,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listSyllabus(
  entityId: string
): Promise<EntitySyllabusSubject[]> {
  const { data, error } = await db
    .from('entity_syllabus_subject')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createSyllabusSubject(
  entityId: string,
  input: SyllabusSubjectInput
): Promise<EntitySyllabusSubject> {
  const { data, error } = await db
    .from('entity_syllabus_subject')
    .insert({
      entity_id: entityId,
      subject_name: input.subjectName,
      topics: input.topics ?? [],
      description: input.description ?? null,
      pdf_url: input.pdfUrl ?? null,
      video_link: input.videoLink ?? null,
      study_notes: input.studyNotes ?? null,
      books: input.books ?? null,
      weightage_percent: input.weightagePercent ?? null,
      display_order: input.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSyllabusSubject(
  id: string,
  input: Partial<SyllabusSubjectInput>
): Promise<void> {
  const updates: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    subjectName: 'subject_name',
    topics: 'topics',
    description: 'description',
    pdfUrl: 'pdf_url',
    videoLink: 'video_link',
    studyNotes: 'study_notes',
    books: 'books',
    weightagePercent: 'weightage_percent',
    displayOrder: 'display_order',
  }
  for (const [k, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  }
  const { error } = await db
    .from('entity_syllabus_subject')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteSyllabusSubject(id: string): Promise<void> {
  const { error } = await db
    .from('entity_syllabus_subject')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reorderSyllabusSubjects(
  entityId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .from('entity_syllabus_subject')
        .update({ display_order: i })
        .eq('id', id)
        .eq('entity_id', entityId)
    )
  )
}
