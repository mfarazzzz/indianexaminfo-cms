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
  /** "proposal" = goes to provenance (ai_metadata), never to the form (S2.6).
   *  "step" = a how-to / carry line the editor authors into a content module. */
  kind: "field" | "date" | "proposal" | "step";
  current: string;
  proposed: string;
  sourceQuote: string;
  confidence: number;
  /** Accept pre-checked only when current is empty, confident AND unflagged. */
  defaultAccept: boolean;
  /** No form slot for this fact (S3 will add the field) — never auto-applied. */
  noFieldYet: boolean;
  /** S2.15 (2e): the proposal equals the current value (or only re-dates an
   *  evergreen identity) — shown collapsed as "No change", never a decision. */
  noChange?: boolean;
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
  /** B2 kind === "step": where this authored line lands on apply — the content
   *  module (admit-card / application-process), the array (steps / carry) and the
   *  original order so a mid-list edit still writes back in sequence. */
  stepTarget?: { module: "admit-card" | "application-process"; field: "steps" | "carry"; order: number };
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
  /** S2.14b — the editor's `vacancy` form field (a string; parsed to int on save). */
  vacancy?: string;
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

// ── S2.15 (2e) — noise + identity guardrails ────────────────────────────────
const normEq = (a: string, b: string): boolean =>
  (a ?? "").replace(/\s+/g, " ").trim().toLowerCase() === (b ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** URL equality ignoring case and a trailing slash (the PET "…gov.in" vs
 *  "…gov.in/" no-op). Empty on either side is NOT equal (nothing to compare). */
const urlEq = (a: string, b: string): boolean => {
  const clean = (s: string) => (s ?? "").trim().toLowerCase().replace(/\/+$/, "");
  const ca = clean(a), cb = clean(b);
  return ca !== "" && ca === cb;
};

/** Identity core: drop years + lifecycle words so a name that differs ONLY by
 *  them reads as unchanged — an evergreen identity must not be re-dated. */
const IDENTITY_NOISE = /\b(?:19|20)\d{2}\b|\badmit\s*card\b|\bresult\b|\bnotification\b|\bexam\s*date\b|\banswer\s*key\b|\bcut[\s-]*off\b|\bmerit\s*list\b|\bstatus\b/gi;
const identityCore = (s: string): string =>
  (s ?? "").toLowerCase().replace(IDENTITY_NOISE, " ").replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const identityOnlyYearOrLifecycle = (current: string, proposed: string): boolean => {
  const a = identityCore(current), b = identityCore(proposed);
  return a !== "" && a === b;
};

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
  /** S2.15 (2e): an EXISTING record never takes a name/short-name that only
   *  differs by a year or a lifecycle word (identity is evergreen). */
  opts: { isNew?: boolean } = {},
): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const fields = result.fields;
  const isNew = opts.isNew ?? false;

  const pushField = (
    id: string,
    label: string,
    pf: PipelineField | undefined,
    currentStr: string,
    apply: { formPath: string; formValue: unknown } | null,
    noFieldYet = false,
    noChangeOverride = false,
  ) => {
    if (!pf) return;
    const value = fmt(pf.value);
    if (!value) return; // pipeline emptied it (rejected option / not stated) — belongs to the report, not a row
    const conf = pf.confidence;
    const flagged = !!pf.flagged;
    // 2e — a proposal that changes nothing (or only re-dates an evergreen
    // identity on an existing record) is collapsed, never a decision.
    const same = id === "officialWebsite" ? urlEq(currentStr, value) : normEq(currentStr, value);
    const evergreen = !isNew && (id === "name" || id === "shortName") && identityOnlyYearOrLifecycle(currentStr, value);
    const noChange = same || evergreen || noChangeOverride;
    const noChangeReason = evergreen ? "not applied: identity stays evergreen (the year belongs to the edition)" : undefined;
    rows.push({
      id,
      label,
      kind: "field",
      current: currentStr,
      proposed: value,
      sourceQuote: pf.sourceQuote,
      confidence: conf,
      // A flagged or no-change field is NEVER default-accepted.
      defaultAccept: !noFieldYet && !flagged && !noChange && isBlank(currentStr) && conf >= OPTION_CONFIDENCE_FLOOR && !!apply,
      noFieldYet,
      noChange,
      flagReason: flagged ? pf.flagReason : noChangeReason,
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
    // 2e — a slug proposal that resolves to the record's CURRENT category is a
    // no-op ("state-government-jobs" while the field already holds that label).
    const resolvesToCurrent = !!hit && !!currentCatId && hit.id === currentCatId;
    pushField("categorySlug", "Category", catProposal, currentCatLabel,
      hit ? { formPath: "categoryId", formValue: hit.id } : null, !hit, resolvesToCurrent);
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

  // S2.14b — vacancy TOTAL maps to the existing `vacancy` form field (the editor
  // has one); the post-wise list and Important Links have no form slot yet
  // (D-P2 / R2.5), so they are reviewable but never auto-applied.
  if (result.vacancy && result.vacancy.total != null) {
    const cur = fmt(current.vacancy);
    rows.push({
      id: "vacancy",
      label: "Vacancy (total posts)",
      kind: "field",
      current: cur,
      proposed: String(result.vacancy.total),
      sourceQuote: result.vacancy.quote ?? "",
      confidence: 1,
      defaultAccept: isBlank(cur),
      noFieldYet: false,
      formPath: "vacancy",
      formValue: String(result.vacancy.total),
    });
  }
  (result.vacancy?.posts ?? []).forEach((post, i) => {
    rows.push({
      id: `vacancy-post:${i}:${post.name}`,
      label: `Post — ${post.name}`,
      kind: "field",
      current: "",
      proposed: post.count == null ? "—" : `${post.count} posts`,
      sourceQuote: "",
      confidence: 1,
      defaultAccept: false,
      noFieldYet: true,
    });
  });
  (result.importantLinks ?? []).forEach((link, i) => {
    rows.push({
      id: `link:${i}:${link.label}`,
      label: `Link — ${link.label}`,
      kind: "field",
      current: "",
      proposed: `${link.url}  (${link.kind})`,
      sourceQuote: "",
      confidence: 1,
      defaultAccept: false,
      noFieldYet: true,
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

  // B2 (client): the deterministic how-to steps. Each step / carry line is offered
  // beside its verbatim source line, EDITABLE in the drawer, and starts UNCHECKED —
  // the editor authors, never auto-applied. Target module by kind: an admit-card
  // how-to lands in contentModules["admit-card"].steps (and .carry for the
  // documents-to-carry list); an application how-to lands in
  // contentModules["application-process"].steps. confidence is 1 because the
  // detector's lines are the source itself (attested by construction), NOT a model
  // paraphrase — but that never makes them default-accepted.
  (result.steps ?? []).forEach((block) => {
    block.steps.forEach((s, i) => {
      rows.push({
        id: `step:${block.module}:steps:${i}`,
        label: `Step ${i + 1} — ${block.heading}`,
        kind: "step",
        current: "",
        proposed: s.text,
        sourceQuote: s.sourceQuote,
        confidence: 1,
        defaultAccept: false,
        noFieldYet: false,
        stepTarget: { module: block.module, field: "steps", order: i },
      });
    });
    block.carry.forEach((c, i) => {
      rows.push({
        id: `step:${block.module}:carry:${i}`,
        label: `To carry ${i + 1} — ${block.heading}`,
        kind: "step",
        current: "",
        proposed: c.text,
        sourceQuote: c.sourceQuote,
        confidence: 1,
        defaultAccept: false,
        noFieldYet: false,
        stepTarget: { module: block.module, field: "carry", order: i },
      });
    });
  });

  return rows;
}

/** Fill report numbers shown at the top of the drawer. */
export interface FillReport {
  proposed: number;
  defaultAccepted: number;
  flagged: number;          // server issues + below floor + no field yet + pipeline-flagged
  noFieldYet: number;
  /** S2.15 (2e): proposals that change nothing (equal value / evergreen identity). */
  noChange?: number;
  rejected: number;         // rows the pipeline dropped as not exam data (S2.10)
  mergedWindows: number;    // window pairs the net collapsed into one row (S2.9)
  lowConfidence: string[];  // labels
  missingOptions: string[]; // suggested new options / rejected values
  /**
   * v10: the server's answer-level low_yield issue, if any — "only N of ~M
   * dated events came back". Optional so a pre-v10 FillReport literal still
   * compiles; summarizeFill always sets it (null when there is no such issue).
   */
  yieldWarning?: string | null;
}

export function summarizeFill(rows: ReviewRow[], issues: ExtractionIssue[], result?: PipelineResult): FillReport {
  const lowConfidence: string[] = [];
  const missingOptions: string[] = [];
  let yieldWarning: string | null = null;
  for (const iss of issues) {
    if (iss.reason === "low_confidence") lowConfidence.push(iss.field);
    if (iss.reason === "not_an_option") missingOptions.push(`${iss.field}: ${iss.detail}`);
    if (iss.reason === "no_value") lowConfidence.push(`${iss.field} (not stated)`);
    // v10: one visible line, not a silent count. The FIRST low_yield issue wins
    // (the server adds at most one per answer, for the `dates` field).
    if (iss.reason === "low_yield" && yieldWarning === null) yieldWarning = iss.detail;
  }
  for (const r of rows) {
    if (r.confidence < OPTION_CONFIDENCE_FLOOR && r.proposed) lowConfidence.push(r.label);
    if (r.noFieldYet) missingOptions.push(`${r.label} — no field yet`);
    if (r.flagReason) lowConfidence.push(`${r.label} (${r.flagReason})`);
  }
  return {
    proposed: rows.length,
    defaultAccepted: rows.filter((r) => r.defaultAccept).length,
    flagged: rows.filter((r) => !r.defaultAccept && !r.noChange).length + issues.length,
    noFieldYet: rows.filter((r) => r.noFieldYet).length,
    noChange: rows.filter((r) => r.noChange).length,
    rejected: result ? result.rejected.length : 0,
    mergedWindows: result ? result.mergedWindows.length : 0,
    lowConfidence: Array.from(new Set(lowConfidence)),
    missingOptions: Array.from(new Set(missingOptions)),
    yieldWarning,
  };
}
