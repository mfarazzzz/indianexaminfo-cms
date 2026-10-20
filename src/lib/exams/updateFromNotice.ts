/**
 * updateFromNotice.ts — D-P2 "create an update from a notice" prefill (pure).
 *
 * Turns a reviewed notice extraction (a PipelineResult) into a DRAFT exam update
 * the editor then confirms. It pre-fills ONLY facts the pipeline already attested
 * (never the page's prose): the exam/edition link, a content_type derived from the
 * notice's dominant event, a title, the notice's own dated events, and the
 * ATTESTED important-links as quick links. The body is left empty for the editor
 * to write — an update's words are a human's, not the aggregator's.
 *
 * Nothing is published or saved here; the editor confirms and the service writes.
 */
import type { PipelineResult } from "@/lib/ai/noticePipeline";
import type { ContentType } from "@/types/exam";
import type { NewExamUpdate, UpdateLink } from "@/services/examUpdatesService";

/** The notice's dominant event → the content_type the update belongs to. */
export function contentTypeFromNotice(result: PipelineResult): ContentType {
  const types = new Set(result.rows.map((r) => r.type));
  if (types.has("admit_card")) return "admit-card";
  if (types.has("result") || types.has("merit_list")) return "result";
  if (types.has("answer_key")) return "answer-key";
  if (types.has("cutoff")) return "cutoff";
  if (types.has("application_start") || types.has("application_end")) return "application";
  return "notification";
}

/** The attested important-links become the update's quick links (label + real
 *  url only — a label with no address is a note, not a link). */
export function linksFromNotice(result: PipelineResult): UpdateLink[] {
  return (result.importantLinks ?? []).map((l) => ({ label: l.label, url: l.url }));
}

/** The notice's dated events, as the update's own display dates (label + date). */
function datesFromNotice(result: PipelineResult): { label: string; date: string; isUrgent: boolean }[] {
  return result.rows.map((r) => ({ label: r.label, date: r.date, isUrgent: r.isUrgent }));
}

export interface UpdatePrefillInput {
  examId: string;
  examEditionId?: string | null;
  pillar?: string;
  /** A human slug for the content_post; the editor can change the title after. */
  slug: string;
  /** The editor's session user id (RLS create_post gate). */
  createdBy?: string;
}

/**
 * Build the draft update from a notice. Returns a createExamUpdate input with
 * status 'draft' (never auto-published) and an empty body for the editor to fill.
 */
export function buildUpdateDraftFromNotice(result: PipelineResult, input: UpdatePrefillInput): NewExamUpdate {
  const title = String(result.fields?.name?.value ?? "").trim() || "Notice update";
  return {
    examId: input.examId,
    examEditionId: input.examEditionId ?? null,
    pillar: input.pillar,
    slug: input.slug,
    createdBy: input.createdBy,
    contentType: contentTypeFromNotice(result),
    title,
    body: "", // the editor writes the words — never the aggregator's prose
    kind: "provisional",
    quickLinks: linksFromNotice(result),
    importantDates: datesFromNotice(result),
    status: "draft",
  };
}

/** What the editor MUST confirm before the update is real (surfaced in the UI). */
export const UPDATE_CONFIRM_FIELDS = ["title", "content_type", "body", "links", "publish"] as const;
