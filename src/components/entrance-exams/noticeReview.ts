/**
 * noticeReview.ts — S2.4 review drawer logic (pure, testable).
 *
 * The rule the old AI Fill broke: nothing is ever written silently. Extraction
 * results become ONE ROW PER PROPOSED CHANGE — field · current value · proposed
 * value · source quote · confidence · Accept/Reject — and "Apply accepted"
 * writes to the FORM ONLY (the editor saves; R1.6 holds).
 *
 * Default state: Accept ONLY where the current value is empty AND confidence
 * is ≥ 0.7. Everything else starts Rejected and needs a deliberate click.
 * Fields the form has no slot for (counselling fee, warnings, contacts) are
 * NOT invented writes — they are listed as "no field yet" for the editor.
 */
import type { StructuredExtraction, ExtractionIssue } from "@/lib/ai/aiFillClient";
import type { FieldProposal } from "@/lib/ai/extractionContract";
import { OPTION_CONFIDENCE_FLOOR } from "@/lib/ai/extractionContract";
import { parseDateWindow } from "@/lib/utils/indianDateParser";

/** A date row as the review hands it to the form (DateRow-compatible). */
export interface ProposedDateRow {
  label: string;
  date: string;
  isUrgent: boolean;
  type: string;
  kind: string;
  state: "confirmed" | "expected";
  verified: false;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  time_text?: string;
  phase?: string;
  rank_batch?: string;
  audience?: string;
  source_quote: string;
  confidence: number;
}

export interface ReviewRow {
  /** Stable key: the form field path, or "date:<index>". */
  id: string;
  /** Human field name shown in the drawer. */
  label: string;
  kind: "field" | "date";
  current: string;
  proposed: string;
  sourceQuote: string;
  confidence: number;
  /** Accept pre-checked only when current is empty AND confidence ≥ floor. */
  defaultAccept: boolean;
  /** No form slot for this fact (S3 will add the field) — never auto-applied. */
  noFieldYet: boolean;
  /** For kind === "field": the form path to setValue on apply. */
  formPath?: string;
  /** For kind === "field": the value to write (slug→id already resolved). */
  formValue?: unknown;
  /** For kind === "date": the row to merge into importantDates. */
  row?: ProposedDateRow;
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

/** categories slug → id, resolved at the editor (the DB owns both). */
export interface CategoryLookup { slug: string; id: string }

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

/** Turn one template date answer into a form row (window keys filled). */
function toProposedRow(d: Record<string, unknown>, year: number): ProposedDateRow | null {
  const label = typeof d.label === "string" ? d.label.trim() : "";
  const dateText = typeof d.dateText === "string" ? d.dateText.trim() : "";
  if (!label || !dateText) return null;
  const win = parseDateWindow(dateText, year);
  if (!win.date) return null;
  const row: ProposedDateRow = {
    label,
    date: win.date,
    isUrgent: false,
    type: typeof d.type === "string" && d.type ? d.type : "other",
    kind: typeof d.kind === "string" && d.kind ? d.kind : "other",
    state: "confirmed",
    verified: false,
    source_quote: typeof d.sourceQuote === "string" ? d.sourceQuote : "",
    confidence: typeof d.confidence === "number" ? Math.min(1, Math.max(0, d.confidence)) : 0,
  };
  if (win.end_date) row.end_date = win.end_date;
  if (win.start_time) row.start_time = win.start_time;
  if (win.end_time) row.end_time = win.end_time;
  if (win.time_text) row.time_text = win.time_text;
  if (typeof d.phase === "string" && d.phase.trim()) row.phase = d.phase.trim();
  if (typeof d.rank_batch === "string" && d.rank_batch.trim()) row.rank_batch = d.rank_batch.trim();
  if (d.audience === "candidate" || d.audience === "institute") row.audience = d.audience;
  if (row.kind === "choice_filling" || row.kind === "registration_start" || row.kind === "registration_end") row.isUrgent = true;
  return row;
}

/**
 * Build every review row from one extraction. Ordering: identity/classification
 * first (they decide the record's shape), then dates, then the "no field yet"
 * facts at the end (the editor's S3 backlog).
 */
export function buildReviewRows(
  extraction: StructuredExtraction,
  current: ReviewCurrentValues,
  categories: CategoryLookup[],
  year: number,
): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const fields = extraction.content.fields as Record<string, FieldProposal | null | undefined>;
  const issueByField = new Map<string, ExtractionIssue>();
  for (const iss of extraction.issues) issueByField.set(iss.field, iss);

  const pushField = (
    id: string,
    label: string,
    proposal: FieldProposal | null | undefined,
    currentStr: string,
    apply: { formPath: string; formValue: unknown } | null,
    noFieldYet = false,
  ) => {
    if (!proposal) return;
    const value = fmt(proposal.value);
    if (!value) return; // server flagged it empty — it belongs to the report, not a row
    const conf = typeof proposal.confidence === "number" ? proposal.confidence : 0;
    rows.push({
      id,
      label,
      kind: "field",
      current: currentStr,
      proposed: value,
      sourceQuote: proposal.sourceQuote ?? "",
      confidence: conf,
      defaultAccept: !noFieldYet && isBlank(currentStr) && conf >= OPTION_CONFIDENCE_FLOOR && !!apply,
      noFieldYet,
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
    pushField("categorySlug", "Category", catProposal, fmt(current.categoryId),
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

  const dates = extraction.content.dates ?? [];
  dates.forEach((d, i) => {
    const row = toProposedRow(d as Record<string, unknown>, year);
    if (!row) return;
    const conf = row.confidence;
    rows.push({
      id: `date:${i}:${row.label}`,
      label: `Date — ${row.label}`,
      kind: "date",
      current: "", // per-row current is decided by the merge at apply time (S2.5)
      proposed: describeDateRow(row),
      sourceQuote: row.source_quote,
      confidence: conf,
      defaultAccept: conf >= OPTION_CONFIDENCE_FLOOR,
      noFieldYet: false,
      row,
    });
  });

  return rows;
}

/** Fill report numbers shown at the top of the drawer. */
export interface FillReport {
  proposed: number;
  defaultAccepted: number;
  flagged: number;          // server issues + below floor + no field yet
  noFieldYet: number;
  lowConfidence: string[];  // labels
  missingOptions: string[]; // suggested new options / rejected values
}

export function summarizeFill(rows: ReviewRow[], issues: ExtractionIssue[]): FillReport {
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
  }
  return {
    proposed: rows.length,
    defaultAccepted: rows.filter((r) => r.defaultAccept).length,
    flagged: rows.filter((r) => !r.defaultAccept).length + issues.length,
    noFieldYet: rows.filter((r) => r.noFieldYet).length,
    lowConfidence: Array.from(new Set(lowConfidence)),
    missingOptions: Array.from(new Set(missingOptions)),
  };
}
