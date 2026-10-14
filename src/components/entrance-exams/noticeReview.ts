/**
 * noticeReview.ts — S2.4/S2.10 review drawer logic (pure, testable).
 *
 * The rule the old AI Fill broke: nothing is ever written silently. Extraction
 * results become ONE ROW PER PROPOSED CHANGE — field · current value · proposed
 * value · source quote · confidence · Accept/Reject — and "Apply accepted"
 * writes to the FORM ONLY (the editor saves; R1.6 holds).
 *
 * S2.10 (ONE CODE PATH): this consumes a PipelineResult produced by
 * postProcessExtraction — the SAME authority the golden test pins. It no longer
 * re-derives kind/type/time from labels (that per-row duplicate has been
 * deleted); the pipeline owns derivation, the verbatim-quote check, URL
 * hygiene, distribution rejection, eligibility/fee guards, window pairing and
 * the notice-issue-date provenance. buildReviewRows only MAPS that result to
 * review rows and decides default-Accept.
 *
 * Default state: Accept ONLY where the current value is empty AND confidence
 * is ≥ 0.7 AND the pipeline did NOT flag the item. Flagged fields/dates start
 * Rejected and show their flagReason. Facts with no form slot (counselling fee,
 * warnings, contacts) are "no field yet" — never auto-applied.
 */
import type { ExtractionIssue } from "@/lib/ai/aiFillClient";
import { OPTION_CONFIDENCE_FLOOR } from "@/lib/ai/extractionContract";
import type { PipelineDateRow, PipelineField, PipelineResult } from "@/lib/ai/noticePipeline";

/** A date row as the review hands it to the form — the pipeline's shape. */
export type ProposedDateRow = PipelineDateRow;

export interface ReviewRow {
  /** Stable key: the form field path, or "date:<index>". */
  id: string;
  /** Human field name shown in the drawer. */
  label: string;
  /** "proposal" = goes to provenance (ai_metadata), never to the form (S2.6). */
  kind: "field" | "date" | "proposal";
  current: string;
  proposed: string;
  sourceQuote: string;
  confidence: number;
  /** Accept pre-checked only when current is empty, confident AND unflagged. */
  defaultAccept: boolean;
  /** No form slot for this fact (S3 will add the field) — never auto-applied. */
  noFieldYet: boolean;
  /** Set when the pipeline flagged this item; explains WHY it is not trusted. */
  flagReason?: string;
  /** For kind === "field": the form path to setValue on apply. */
  formPath?: string;
  /** For kind === "field": the value to write (slug→id already resolved). */
  formValue?: unknown;
  /** For kind === "date": the row to merge into importantDates. */
  row?: ProposedDateRow;
  /** For kind === "proposal": the document reference being recorded. */
  documentReference?: { label: string; date: string; sourceQuote: string };
}

export interface ReviewCurrentValues {
  name?: string;
  shortName?: string;
  conductingBody?: string;
  officialWebsite?: string;
  region?: string;
  categoryId?: string;
  selectionModel?: string;
  entityType?: string;
  eligibility?: Record<string, unknown> | null;
  applicationFee?: Record<string, unknown> | null;
  importantDates?: { label: string; date: string }[];
}

/** categories slug → id, resolved at the editor (the DB owns both). `name` is
 *  carried so the drawer can show the current category's LABEL, not its UUID. */
export interface CategoryLookup { slug: string; id: string; name?: string }

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (typeof v === "object" && Object.keys(v as object).length === 0);

const fmt = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** The row's proposed date rendered for the "proposed" column. */
export function describeDateRow(r: ProposedDateRow): string {
  const parts = [r.date];
  if (r.end_date) parts.push(`→ ${r.end_date}`);
  if (r.end_time) parts.push(`end ${r.end_time} IST`);
  if (r.start_time) parts.push(`from ${r.start_time} IST`);
  if (r.time_text) parts.push(r.time_text);
  if (r.phase) parts.push(r.phase);
  return parts.join(" ");
}

/**
 * Build every review row from a PipelineResult. Ordering: identity/classification
 * first (they decide the record's shape), then dates, then the "no field yet"
 * facts at the end (the editor's S3 backlog). Kind/type/time are ALREADY derived
 * by the pipeline; nothing here re-infers them.
 */
export function buildReviewRows(
  result: PipelineResult,
  current: ReviewCurrentValues,
  categories: CategoryLookup[],
): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const fields = result.fields;

  const pushField = (
    id: string,
    label: string,
    pf: PipelineField | undefined,
    currentStr: string,
    apply: { formPath: string; formValue: unknown } | null,
    noFieldYet = false,
  ) => {
    if (!pf) return;
    const value = fmt(pf.value);
    if (!value) return; // pipeline emptied it (rejected option / not stated) — belongs to the report, not a row
    const conf = pf.confidence;
    const flagged = !!pf.flagged;
    rows.push({
      id,
      label,
      kind: "field",
      current: currentStr,
      proposed: value,
      sourceQuote: pf.sourceQuote,
      confidence: conf,
      // A flagged field is NEVER default-accepted, whatever its confidence.
      defaultAccept: !noFieldYet && !flagged && isBlank(currentStr) && conf >= OPTION_CONFIDENCE_FLOOR && !!apply,
      noFieldYet,
      flagReason: flagged ? pf.flagReason : undefined,
      formPath: apply?.formPath,
      formValue: apply?.formValue,
    });
  };

  pushField("name", "Exam / admission name", fields.name, fmt(current.name),
    { formPath: "name", formValue: fields.name?.value });
  pushField("shortName", "Short name", fields.shortName, fmt(current.shortName),
    { formPath: "shortName", formValue: fields.shortName?.value });
  pushField("conductingBody", "Conducting body", fields.conductingBody, fmt(current.conductingBody),
    { formPath: "conductingBody", formValue: fields.conductingBody?.value });
  pushField("officialWebsite", "Official website", fields.officialWebsite, fmt(current.officialWebsite),
    { formPath: "officialWebsite", formValue: fields.officialWebsite?.value });
  pushField("region", "Region", fields.region, fmt(current.region),
    { formPath: "region", formValue: fields.region?.value });

  const catProposal = fields.categorySlug;
  if (catProposal?.value) {
    const hit = categories.find((c) => c.slug === String(catProposal.value).trim().toLowerCase());
    // S2.14a: the form stores the category by ID, but a raw UUID on the
    // "current:" side is meaningless to the editor — resolve id → label.
    const currentCatId = String(current.categoryId ?? "").trim();
    const currentCatLabel = currentCatId
      ? (categories.find((c) => c.id === currentCatId)?.name ?? currentCatId)
      : "";
    pushField("categorySlug", "Category", catProposal, currentCatLabel,
      hit ? { formPath: "categoryId", formValue: hit.id } : null, !hit);
  }

  pushField("selectionModel", "How are candidates selected?", fields.selectionModel, fmt(current.selectionModel),
    { formPath: "selectionModel", formValue: fields.selectionModel?.value });
  pushField("entityType", "Entity type", fields.entityType, fmt(current.entityType),
    // entityType is DERIVED from the pillar in this editor — never a blind write.
    null, true);

  pushField("eligibility", "Eligibility", fields.eligibility, fmt(current.eligibility),
    null, true); // shape needs the edition's eligibility object — S3 field work
  pushField("fee", "Fee (as printed)", fields.fee, fmt(current.applicationFee),
    null, true); // counselling vs application fee: NO field yet (S2.7 expectation)
  pushField("warnings", "Warnings / rules", fields.warnings, "", null, true);
  pushField("contacts", "Contact details", fields.contacts, "", null, true);
  pushField("noticeReference", "Notice reference", fields.noticeReference, "", null, true);

  // Date rows: the pipeline already parsed the window, derived kind→type via
  // the selection-model gate, stripped the URL, rejected distribution content,
  // paired split windows and checked the quote verbatim. Map them straight.
  result.rows.forEach((row, i) => {
    const conf = row.confidence;
    rows.push({
      id: `date:${i}:${row.label}`,
      label: `Date — ${row.label}`,
      kind: "date",
      current: "", // per-row current is decided by the merge at apply time (S2.5)
      proposed: describeDateRow(row),
      sourceQuote: row.source_quote,
      confidence: conf,
      // A date whose quote is not verbatim in the source is flagged — offered
      // only on a deliberate click, never by default.
      defaultAccept: conf >= OPTION_CONFIDENCE_FLOOR && !row.flagged,
      noFieldYet: false,
      flagReason: row.flagged ? row.flagReason : undefined,
      row,
    });
  });

  // S2.6: notices the source only REFERS TO become document-reference
  // proposals — provenance, never a "Notification Release" date row. The
  // pipeline already parsed their dates.
  result.references.forEach((ref, i) => {
    rows.push({
      id: `reference:${i}:${ref.label}`,
      label: `Document reference — ${ref.label}`,
      kind: "proposal",
      current: "",
      proposed: ref.date ? `recorded as a reference (dated ${ref.date}), NOT a timeline row` : "recorded as a reference, NOT a timeline row",
      sourceQuote: ref.sourceQuote,
      confidence: 1, // provenance: safe by default, records nothing risky
      defaultAccept: true,
      noFieldYet: false,
      documentReference: { label: ref.label, date: ref.date, sourceQuote: ref.sourceQuote },
    });
  });

  // FU1: the notice's OWN issue date — provenance, shown so the editor sees the
  // press-release date was recorded, not turned into a timeline/notification row.
  if (result.provenance?.noticeIssueDate) {
    rows.push({
      id: `provenance:noticeDate:${result.provenance.noticeIssueDate}`,
      label: "Notice issue date (provenance)",
      kind: "proposal",
      current: "",
      proposed: `recorded as provenance (notice.date ${result.provenance.noticeIssueDate}), NOT a timeline row`,
      sourceQuote: result.provenance.noticeIssueQuote ?? "",
      confidence: 1,
      defaultAccept: true,
      noFieldYet: false,
      documentReference: { label: "Notice issue date", date: result.provenance.noticeIssueDate, sourceQuote: result.provenance.noticeIssueQuote ?? "" },
    });
  }

  return rows;
}

/** Fill report numbers shown at the top of the drawer. */
export interface FillReport {
  proposed: number;
  defaultAccepted: number;
  flagged: number;          // server issues + below floor + no field yet + pipeline-flagged
  noFieldYet: number;
  rejected: number;         // rows the pipeline dropped as not exam data (S2.10)
  mergedWindows: number;    // window pairs the net collapsed into one row (S2.9)
  lowConfidence: string[];  // labels
  missingOptions: string[]; // suggested new options / rejected values
}

export function summarizeFill(rows: ReviewRow[], issues: ExtractionIssue[], result?: PipelineResult): FillReport {
  const lowConfidence: string[] = [];
  const missingOptions: string[] = [];
  for (const iss of issues) {
    if (iss.reason === "low_confidence") lowConfidence.push(iss.field);
    if (iss.reason === "not_an_option") missingOptions.push(`${iss.field}: ${iss.detail}`);
    if (iss.reason === "no_value") lowConfidence.push(`${iss.field} (not stated)`);
  }
  for (const r of rows) {
    if (r.confidence < OPTION_CONFIDENCE_FLOOR && r.proposed) lowConfidence.push(r.label);
    if (r.noFieldYet) missingOptions.push(`${r.label} — no field yet`);
    if (r.flagReason) lowConfidence.push(`${r.label} (${r.flagReason})`);
  }
  return {
    proposed: rows.length,
    defaultAccepted: rows.filter((r) => r.defaultAccept).length,
    flagged: rows.filter((r) => !r.defaultAccept).length + issues.length,
    noFieldYet: rows.filter((r) => r.noFieldYet).length,
    rejected: result ? result.rejected.length : 0,
    mergedWindows: result ? result.mergedWindows.length : 0,
    lowConfidence: Array.from(new Set(lowConfidence)),
    missingOptions: Array.from(new Set(missingOptions)),
  };
}
