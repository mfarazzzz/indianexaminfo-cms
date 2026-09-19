/**
 * derivedStatusService.ts — read-only access to the exam_derived_status VIEW.
 *
 * The frontend computes the status a visitor sees from the current edition's
 * important_dates (via the exam_derived_status VIEW), NOT from the manual
 * exam_editions.status column. The CMS never read this VIEW, so the editor
 * could show "Upcoming" while the live site showed "Result Awaited".
 *
 * This service exposes the same VIEW to the CMS so the Dates & Status tab can
 * show the DERIVED status prominently, labelled as what the site shows, and
 * flag when the manual override disagrees with it.
 *
 * READ-ONLY. No writes. Mirrors the frontend's fetchDerivedStatuses().
 */
import { db } from "@/lib/supabase/client";

/** The status strings the exam_derived_status VIEW can emit (frontend vocabulary). */
export type DerivedStatus =
  | "dates-awaited"
  | "upcoming"
  | "notified"
  | "registration-open"
  | "registration-closed"
  | "admit-card-out"
  | "ongoing"
  | "result-awaited"
  | "result-declared"
  | "postponed";

export interface DerivedStatusRow {
  examId: string;
  derivedStatus: DerivedStatus;
  hasConfirmedDates: boolean;
  nextConfirmedDate: string | null;
  examStartDate: string | null;
  examEndDate: string | null;
  resultDate: string | null;
}

/** Human label for a derived status (title-case, no hyphens). */
export function derivedStatusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Read the derived status for a single exam from the VIEW. Returns null if the
 * exam isn't in the VIEW (e.g. unpublished, or no dates) or on any error —
 * derived status is non-fatal context, never a hard dependency of the editor.
 */
export async function getDerivedStatus(examId: string): Promise<DerivedStatusRow | null> {
  if (!examId) return null;
  try {
    const { data, error } = await db
      .from("exam_derived_status")
      .select(
        "exam_id, derived_status, has_confirmed_dates, next_confirmed_date, exam_start_date, exam_end_date, result_date"
      )
      .eq("exam_id", examId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      examId: data.exam_id as string,
      derivedStatus: data.derived_status as DerivedStatus,
      hasConfirmedDates: (data.has_confirmed_dates as boolean) ?? false,
      nextConfirmedDate: (data.next_confirmed_date as string) ?? null,
      examStartDate: (data.exam_start_date as string) ?? null,
      examEndDate: (data.exam_end_date as string) ?? null,
      resultDate: (data.result_date as string) ?? null,
    };
  } catch {
    return null;
  }
}
