/**
 * syllabusService.ts — structured, EXAM-IDENTITY-level syllabus (Option A).
 *
 * Subjects with topics + typed weightage, stored relationally in exam_syllabus_subjects
 * (not jsonb) so a DB CHECK + trigger enforce the weightage shape across ALL write paths.
 * The per-exam unit (exams.syllabus_weightage_type) is chosen once and applies to every
 * subject's numeric weightage_value.
 *
 * Three-layer validation: (1) DB CHECK on syllabus_weightage_type enum, (2) DB trigger that
 * blocks a weightage_value with no exam unit, (3) this service (layer 3) for friendly errors.
 */
import { db } from "@/lib/supabase/client";
import { revalidateExams } from "@/lib/revalidate";

export type WeightageType = "marks" | "questions" | "percent";
export const WEIGHTAGE_TYPES: WeightageType[] = ["marks", "questions", "percent"];
export const WEIGHTAGE_TYPE_LABELS: Record<WeightageType, string> = {
  marks: "Marks", questions: "Questions", percent: "Percent (%)",
};

export interface SyllabusSubject {
  id: string;
  examId: string;
  subject: string;
  topics: string | null;
  weightageValue: number | null;
  displayOrder: number;
}

function mapRow(r: Record<string, unknown>): SyllabusSubject {
  return {
    id: r.id as string,
    examId: r.exam_id as string,
    subject: r.subject as string,
    topics: (r.topics as string) ?? null,
    weightageValue: (r.weightage_value as number) ?? null,
    displayOrder: (r.display_order as number) ?? 0,
  };
}

/** The exam's chosen weightage unit (null until set). */
export async function getWeightageType(examId: string): Promise<WeightageType | null> {
  const { data, error } = await db.from("exams").select("syllabus_weightage_type").eq("id", examId).single();
  if (error) { console.error("[syllabusService] getWeightageType failed:", error); return null; }
  return (data?.syllabus_weightage_type as WeightageType) ?? null;
}

/** Set the exam's weightage unit. Must be set before any subject can carry a value (DB trigger). */
export async function setWeightageType(examId: string, type: WeightageType | null): Promise<void> {
  const { error } = await db.from("exams").update({ syllabus_weightage_type: type }).eq("id", examId);
  if (error) throw error;
  revalidateExams().catch(() => {});
}

export async function listSubjects(examId: string): Promise<SyllabusSubject[]> {
  const { data, error } = await db
    .from("exam_syllabus_subjects")
    .select("*")
    .eq("exam_id", examId)
    .order("display_order", { ascending: true });
  if (error) { console.error("[syllabusService] listSubjects failed:", error); return []; }
  return (data ?? []).map((r: any) => mapRow(r));
}

export interface SubjectInput {
  subject: string;
  topics?: string | null;
  weightageValue?: number | null;
  displayOrder?: number;
}

export async function createSubject(examId: string, input: SubjectInput): Promise<SyllabusSubject> {
  // Layer 3 guard mirroring the DB trigger, for a friendly message before the DB fires.
  if (input.weightageValue != null) {
    const t = await getWeightageType(examId);
    if (!t) throw new Error("Set the exam's weightage unit (Marks / Questions / Percent) before entering a weightage value.");
  }
  const { data, error } = await db
    .from("exam_syllabus_subjects")
    .insert({
      exam_id: examId,
      subject: input.subject,
      topics: input.topics ?? null,
      weightage_value: input.weightageValue ?? null,
      display_order: input.displayOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  revalidateExams().catch(() => {});
  return mapRow(data as Record<string, unknown>);
}

export async function updateSubject(id: string, input: Partial<SubjectInput>): Promise<SyllabusSubject> {
  const updates: Record<string, unknown> = {};
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.topics !== undefined) updates.topics = input.topics;
  if (input.weightageValue !== undefined) updates.weightage_value = input.weightageValue;
  if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;
  const { data, error } = await db
    .from("exam_syllabus_subjects")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  revalidateExams().catch(() => {});
  return mapRow(data as Record<string, unknown>);
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await db.from("exam_syllabus_subjects").delete().eq("id", id);
  if (error) throw error;
  revalidateExams().catch(() => {});
}
