/**
 * noticeProvenance.ts — S2.6: the notice as a document.
 *
 * Every "update from a notice" records WHERE the data came from, in the
 * `exams.ai_metadata` jsonb, following the shape documented in
 * supabase/proposed/a1_ai_fill_options.sql:
 *
 *   fill_source, notice { reference, date }, extracted_at, template/provider/
 *   model, report { filled, skipped, low_confidence, missing_options },
 *   field_quotes { field: verbatim line }, pending_documents (the proposals
 *   to attach the notice to Documents & links and to record the earlier
 *   notices it REFERENCES), verified:false, published_by_ai:false.
 *
 * Two rules that exist because of the D.El.Ed analysis (§15.3 pitfall 1):
 *  • every applied field keeps its verbatim sourceQuote in field_quotes —
 *    the editor can always compare what was written against what the notice
 *    actually said;
 *  • a notice the current notice only REFERS TO ("पूर्व प्रकाशित विज्ञप्ति
 *    दिनांक 07.08.2026") is recorded as a document reference, never as a
 *    "Notification Release" date row.
 *
 * ai_metadata is written by the EDITOR's save, merged over the previous value
 * (read-modify-write at the call site) — never by the extraction itself.
 */
import type { ReviewRow, FillReport } from "@/components/entrance-exams/noticeReview";
import type { ExtractionIssue } from "@/lib/ai/aiFillClient";

export interface ProvenanceInput {
  /** How the source text reached us. PDF/OCR (S5) will add "notice_pdf". */
  sourceType: "pasted_text" | "url";
  /** The notice's own reference + date, as extracted (fields.noticeReference). */
  noticeReference?: string;
  noticeDate?: string;
  provider: string;
  model: string;
  template: string;
  report: FillReport;
  issues: ExtractionIssue[];
  /** Rows the editor ACCEPTED (they are the ones quoted). */
  acceptedRows: ReviewRow[];
  /** Earlier notices this notice refers to — document references, not dates. */
  documentReferences?: { label: string; date: string; sourceQuote: string }[];
}

/** Merge rule: newest run wins per key; history is kept under runs[]. */
export function buildNoticeAiMetadata(
  previous: Record<string, unknown> | undefined,
  input: ProvenanceInput,
  nowIso: string,
): Record<string, unknown> {
  const fieldQuotes: Record<string, string> = {};
  const filled: string[] = [];
  for (const r of input.acceptedRows) {
    if (!r.sourceQuote) continue;
    fieldQuotes[r.id] = r.sourceQuote;
    filled.push(r.id);
  }

  const skipped = input.report.missingOptions.map((m) => ({ field: m, reason: "no_field_or_option" }));
  const lowConfidence = input.report.lowConfidence.map((field) => ({ field }));

  const run = {
    fill_source: input.sourceType,
    notice: {
      reference: input.noticeReference ?? null,
      date: input.noticeDate ?? null,
    },
    extracted_at: nowIso,
    template: input.template,
    provider: input.provider,
    model: input.model,
    report: {
      filled,
      skipped,
      low_confidence: lowConfidence,
      missing_options: input.report.missingOptions,
      issues: input.issues,
    },
    field_quotes: fieldQuotes,
    pending_documents: [
      // The notice itself → "add it to Documents & links" (PDF upload is S5;
      // for pasted text this records the proposal + the quote to verify).
      { kind: "notice_attachment", note: "Attach the notice PDF/file in Resources, then link it here." },
      ...(input.documentReferences ?? []).map((d) => ({
        kind: "document_reference",
        label: d.label,
        date: d.date,
        sourceQuote: d.sourceQuote,
      })),
    ],
    // YMYL floor: an AI run NEVER claims verification or publication.
    verified: false,
    published_by_ai: false,
  };

  const prevRuns = Array.isArray(previous?.runs) ? (previous!.runs as unknown[]) : [];
  return {
    ...(previous ?? {}),
    ...run,
    runs: [...prevRuns, run].slice(-10), // last ten provenance runs, newest last
  };
}
