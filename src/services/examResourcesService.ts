/**
 * examResourcesService.ts — CRUD for exam_resources, the ACCUMULATED LIBRARY (level 3).
 *
 * Year-tagged materials that grow across cycles: previous papers, study material, mock
 * tests, sample papers, syllabus PDFs. Attached to the EXAM identity (not an edition) —
 * `year` is a free integer, so a 2019 paper can live on an exam whose oldest edition is 2026.
 *
 * ALL writes go through this service (URL normalized here). This is a NEW write path built
 * on the service layer from day one — the lesson from the Excel bypass (see NORMALIZATION_AUDIT).
 */
import { db } from "@/lib/supabase/client";
import { normalizeUrlOrThrow } from "@/lib/utils";
import { revalidateExams } from "@/lib/revalidate";

export type ResourceKind =
  | "previous-paper"
  | "study-material"
  | "mock-test"
  | "sample-paper"
  | "syllabus-pdf";

export const RESOURCE_KINDS: ResourceKind[] = [
  "previous-paper", "study-material", "mock-test", "sample-paper", "syllabus-pdf",
];

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  "previous-paper": "Previous Year Paper",
  "study-material": "Study Material",
  "mock-test": "Mock Test",
  "sample-paper": "Sample Paper",
  "syllabus-pdf": "Syllabus PDF",
};

export interface ExamResource {
  id: string;
  examId: string;
  kind: ResourceKind;
  year: number | null;
  stageLabel: string | null;
  title: string;
  url: string;
  description: string | null;
  language: string | null;
  paperType: string | null;
  fileSizeKb: number | null;
  relatedResourceId: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): ExamResource {
  return {
    id: r.id as string,
    examId: r.exam_id as string,
    kind: r.kind as ResourceKind,
    year: (r.year as number) ?? null,
    stageLabel: (r.stage_label as string) ?? null,
    title: r.title as string,
    url: r.url as string,
    description: (r.description as string) ?? null,
    language: (r.language as string) ?? null,
    paperType: (r.paper_type as string) ?? null,
    fileSizeKb: (r.file_size_kb as number) ?? null,
    relatedResourceId: (r.related_resource_id as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    isPublished: (r.is_published as boolean) ?? true,
    displayOrder: (r.display_order as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface ResourceInput {
  kind: ResourceKind;
  year?: number | null;
  stageLabel?: string | null;
  title: string;
  url: string;
  description?: string | null;
  language?: string | null;
  paperType?: string | null;
  fileSizeKb?: number | null;
  relatedResourceId?: string | null;
  sourceUrl?: string | null;
  isPublished?: boolean;
  displayOrder?: number;
}

/**
 * List resources for an exam (CMS view — includes unpublished). Excludes soft-deleted.
 * Ordered newest year first, then display_order, then title.
 */
export async function listResources(examId: string): Promise<ExamResource[]> {
  const { data, error } = await db
    .from("exam_resources")
    .select("*")
    .eq("exam_id", examId)
    .is("deleted_at", null)
    .order("year", { ascending: false, nullsFirst: false })
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) {
    console.error(`[examResourcesService] listResources(${examId}) failed:`, error);
    return [];
  }
  return (data ?? []).map((r: any) => mapRow(r));
}

/** Syllabus-PDF resources for an exam (for the edition's syllabus picker). */
export async function listSyllabusPdfs(examId: string): Promise<ExamResource[]> {
  const { data, error } = await db
    .from("exam_resources")
    .select("*")
    .eq("exam_id", examId)
    .eq("kind", "syllabus-pdf")
    .is("deleted_at", null)
    .order("year", { ascending: false, nullsFirst: false });
  if (error) {
    console.error(`[examResourcesService] listSyllabusPdfs(${examId}) failed:`, error);
    return [];
  }
  return (data ?? []).map((r: any) => mapRow(r));
}

export async function createResource(examId: string, input: ResourceInput): Promise<ExamResource> {
  const { data, error } = await db
    .from("exam_resources")
    .insert({
      exam_id: examId,
      kind: input.kind,
      year: input.year ?? null,
      stage_label: input.stageLabel ?? null,
      title: input.title,
      // URL normalized through the service (the guard the Excel bypass skipped).
      url: normalizeUrlOrThrow(input.url),
      description: input.description ?? null,
      language: input.language ?? null,
      paper_type: input.paperType ?? null,
      file_size_kb: input.fileSizeKb ?? null,
      related_resource_id: input.relatedResourceId ?? null,
      source_url: input.sourceUrl ? normalizeUrlOrThrow(input.sourceUrl) : null,
      is_published: input.isPublished ?? true,
      display_order: input.displayOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  revalidateExams().catch(() => {});
  return mapRow(data as Record<string, unknown>);
}

export async function updateResource(id: string, input: Partial<ResourceInput>): Promise<ExamResource> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.kind !== undefined) updates.kind = input.kind;
  if (input.year !== undefined) updates.year = input.year;
  if (input.stageLabel !== undefined) updates.stage_label = input.stageLabel;
  if (input.title !== undefined) updates.title = input.title;
  if (input.url !== undefined) updates.url = normalizeUrlOrThrow(input.url);
  if (input.description !== undefined) updates.description = input.description;
  if (input.language !== undefined) updates.language = input.language;
  if (input.paperType !== undefined) updates.paper_type = input.paperType;
  if (input.fileSizeKb !== undefined) updates.file_size_kb = input.fileSizeKb;
  if (input.relatedResourceId !== undefined) updates.related_resource_id = input.relatedResourceId;
  if (input.sourceUrl !== undefined) updates.source_url = input.sourceUrl ? normalizeUrlOrThrow(input.sourceUrl) : null;
  if (input.isPublished !== undefined) updates.is_published = input.isPublished;
  if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;

  const { data, error } = await db
    .from("exam_resources")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  revalidateExams().catch(() => {});
  return mapRow(data as Record<string, unknown>);
}

/** Soft delete — sets deleted_at so it drops out of every read (public + CMS). */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await db
    .from("exam_resources")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidateExams().catch(() => {});
}
