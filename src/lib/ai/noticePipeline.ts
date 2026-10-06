/**
 * noticePipeline.ts — OUR deterministic post-processing of a raw model answer.
 *
 * This is the half the golden test (S2.7) exists to prove: whatever the model
 * emits, the platform's output is decided by code, not luck:
 *   1. parse         — strip code fences / trailing prose, JSON.parse or throw
 *                      with a plain-words message (never a silent empty result);
 *   2. option check  — dropdowns only from the allowed lists, confidence ≥ 0.7
 *                      (the S2.1 contract, via resolveOption);
 *   3. kind/type map — the S2.2 contract: TYPE IS DERIVED FROM KIND via
 *                      typeForKind, so an invented model "type" cannot reach
 *                      the row; unknown labels become custom rows (kept);
 *   4. date/time     — parseDateWindow (DD.MM, Hindi months, "से" ranges,
 *                      "सायं 06:00 बजे" clocks, "(अपराह्न)" → time_text);
 *   5. URL hygiene   — normalizeUrl strips utm/tracking params (R1.8);
 *   6. distribution  — content from the "प्रतिलिपि / copy to" block is
 *                      REJECTED wherever it appears (§15.3 pitfall 2);
 *   7. quote guard   — a source quote must be findable verbatim in the source
 *                      text; the "समस्त आवंटित अभ्यर्थी" mistranscription
 *                      (§15.3 pitfall 1) is FLAGGED, never smoothed over.
 *
 * The ai-fill Edge Function runs its own mirror of steps 1–4 before answering
 * (templates.ts); this module is the browser-side authority the golden test
 * pins, so the pipeline's guarantees do not depend on which side validated.
 */
import { resolveOption, type AllowedOptions, type FieldProposal } from "@/lib/ai/extractionContract";
import { typeForKind, normalizeLabel, TENTATIVE_SIGNALS, type DateEventKind } from "@/lib/dates/normalizeLabel";
import { parseDateWindow } from "@/lib/utils/indianDateParser";
import { normalizeUrl } from "@/lib/utils";

export interface PipelineField {
  value: string;
  confidence: number;
  sourceQuote: string;
  reason?: string;
  flagged: boolean;
  flagReason?: string;
  suggestedNewOption?: string;
}

export interface PipelineDateRow {
  label: string;
  date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  time_text?: string;
  type: string;
  kind: string;
  phase?: string;
  rank_batch?: string;
  audience?: string;
  isUrgent: boolean;
  state: "confirmed" | "expected";
  verified: false;
  source_quote: string;
  confidence: number;
}

export interface PipelineResult {
  fields: Record<string, PipelineField>;
  rows: PipelineDateRow[];
  references: { label: string; date: string; sourceQuote: string }[];
  rejected: { label: string; reason: string }[];
  warnings: string[];
}

/** The structural marker for addressing metadata on UP-style notices. */
const DISTRIBUTION_MARKER = /प्रतिलिपि|अतः प्रतिलिपि|copy to\b|cc to\b/i;
const DISTRIBUTION_HINT = /जिलाधिकारी| district magistrate| डी.आइ.टी|diet|bank|संविभागीय|मंडल अधिकारी/i;

/** Everything after the first "प्रतिलिपि" line is ADDRESSING, not content. */
function distributionStart(sourceText: string): number {
  const m = sourceText.match(DISTRIBUTION_MARKER);
  return m && m.index !== undefined ? m.index : -1;
}

/** Whitespace-normalized containment — quotes vs source (Devanagari-safe). */
function quoteIn(quote: string, text: string): boolean {
  const q = quote.replace(/\s+/g, " ").trim();
  if (!q) return false;
  return text.replace(/\s+/g, " ").includes(q);
}

/** Mistranscription guard (§15.3 pitfall 1): the eligibility quote says
 *  "आवंटित अभ्यर्थी" (allotted candidates) with NO negation, while the value
 *  must mean "not yet allotted". When the source line cannot support the
 *  value, the field is FLAGGED for the editor — quote kept, nothing smoothed. */
function eligibilityQuoteGuard(value: string, quote: string): { ok: boolean; hint?: string } {
  if (!value || !quote) return { ok: true };
  const valueSaysNotAllotted = /not\s*(?:yet)?\s*allotted|not\s*been\s*allotted|आवंटित\s*(?:न|नहीं)|नहीं\s*हुआ/i.test(value);
  const quoteSaysAllotted = /आवंटित\s*अभ्यर्थी|allotted\s*candidates/i.test(quote);
  const quoteHasNegation = /न\s*हुआ|नहीं|not\b|उन्मुक्त|न\s*हो/i.test(quote);
  if (valueSaysNotAllotted && quoteSaysAllotted && !quoteHasNegation) {
    return {
      ok: false,
      hint: 'source quote reads "आवंटित अभ्यर्थी" (allotted) without a negation — the notice wording must be verified before this eligibility is trusted',
    };
  }
  return { ok: true };
}

/** Fee kinds must not be blended (domain ref (c)): a counselling/choice fee is
 *  NOT the application fee — flagged "no field yet", never written. */
function feeKindFlag(value: string): string | undefined {
  if (/counselling|choice|\bमॉप|fee.*round/i.test(value) && !/application fee/i.test(value)) {
    return "counselling fee — no field yet";
  }
  return undefined;
}

/**
 * Run the pipeline on ONE raw model answer against the source text it was
 * asked about. Throws AIFillError-style Errors with editor-grade messages.
 */
export function runNoticePipeline(
  rawModelAnswer: string,
  opts: AllowedOptions,
  sourceText: string,
  year: number,
): PipelineResult {
  // 1. parse — the model sometimes wraps JSON in fences or trails a sentence.
  let cleaned = rawModelAnswer.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("AI could not read part of the notice: the model did not answer valid JSON. Nothing was filled.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI could not read part of the notice: the answer was not an object. Nothing was filled.");
  }

  const warnings: string[] = [];

  // 2. fields.
  const rawFields = (parsed.fields ?? {}) as Record<string, FieldProposal | null | undefined>;
  const OPTION_FIELDS: Record<string, string[]> = {
    categorySlug: opts.categories.map((c) => c.slug),
    region: opts.regions.map((r) => r.slug),
    entityType: opts.entityTypes,
    selectionModel: opts.selectionModels,
  };
  const fields: Record<string, PipelineField> = {};
  for (const [name, proposal] of Object.entries(rawFields)) {
    if (!proposal || typeof proposal !== "object") continue;
    let value = String(proposal.value ?? "").trim();
    const quote = String(proposal.sourceQuote ?? "");
    if (name === "officialWebsite" && value) {
      const clean = normalizeUrl(value);
      if (clean !== value) warnings.push(`officialWebsite: stripped tracking/junk → ${clean}`);
      value = clean;
    }
    if (OPTION_FIELDS[name]) {
      const r = resolveOption({ ...proposal, value }, OPTION_FIELDS[name]);
      fields[name] = {
        value: r.value, confidence: r.confidence, sourceQuote: quote,
        reason: proposal.reason, flagged: r.flagged, flagReason: r.reason, suggestedNewOption: r.suggestedNewOption,
      };
      continue;
    }
    const conf = typeof proposal.confidence === "number" ? Math.min(1, Math.max(0, proposal.confidence)) : 0;
    let flagged = false;
    let flagReason: string | undefined;
    if (name === "eligibility" && value) {
      const guard = eligibilityQuoteGuard(value, quote);
      if (!guard.ok) { flagged = true; flagReason = guard.hint; warnings.push(`eligibility: ${guard.hint}`); }
    }
    if (name === "fee" && value) {
      const fk = feeKindFlag(value);
      if (fk) { flagged = true; flagReason = fk; }
    }
    // Quote must be findable in the source — verbatim, or flagged, never silent.
    if (quote && !quoteIn(quote, sourceText)) {
      flagged = true;
      flagReason = flagReason ?? "source quote not found verbatim in the pasted notice";
      warnings.push(`${name}: ${flagReason}`);
    }
    fields[name] = { value, confidence: conf, sourceQuote: quote, reason: proposal.reason, flagged, flagReason };
  }

  // 3–6. dates.
  const distStart = distributionStart(sourceText);
  const rows: PipelineDateRow[] = [];
  const rejected: { label: string; reason: string }[] = [];
  const rawDates = Array.isArray(parsed.dates) ? (parsed.dates as Record<string, unknown>[]) : [];
  for (const d of rawDates) {
    const label = String(d?.label ?? "").trim();
    const dateText = String(d?.dateText ?? "").trim();
    const quote = String(d?.sourceQuote ?? "");
    if (!label) continue;
    // 6. distribution rejection.
    if (DISTRIBUTION_HINT.test(label) || DISTRIBUTION_HINT.test(quote)) {
      rejected.push({ label, reason: "distribution-list content (addressing metadata, not exam data)" });
      continue;
    }
    if (distStart >= 0 && quote && quoteIn(quote, sourceText) && sourceText.replace(/\s+/g, " ").indexOf(quote.replace(/\s+/g, " ").trim()) >= distStart) {
      rejected.push({ label, reason: "content sits in the प्रतिलिपि (copy-to) block" });
      continue;
    }
    // 4. date/time.
    const win = parseDateWindow(dateText, year);
    if (!win.date) { rejected.push({ label, reason: "no parseable date in the text the model gave" }); continue; }
    // 3. kind/type: kind wins; unknown label → normalizeLabel fallback (custom).
    const norm = normalizeLabel(label);
    void norm; // kept for the custom-row fallback below; labels are preserved verbatim
    const kindRaw = String(d?.kind ?? "").trim();
    const kind = (kindRaw || norm.kind) as DateEventKind | string;
    const type = typeForKind(kind); // invented model types are DISCARDED
    const modelType = String(d?.type ?? "").trim();
    if (modelType && modelType !== type) warnings.push(`date "${label}": model type "${modelType}" overridden → "${type}" (derived from kind)`);
    rows.push({
      // SOURCE label kept exactly as the model wrote it — type/kind carry the
      // normalized meaning; nothing the pipeline invented replaces the words.
      label,
      date: win.date,
      ...(win.end_date ? { end_date: win.end_date } : {}),
      ...(win.start_time ? { start_time: win.start_time } : {}),
      ...(win.end_time ? { end_time: win.end_time } : {}),
      ...(win.time_text ? { time_text: win.time_text } : {}),
      type,
      kind,
      ...(String(d?.phase ?? "").trim() ? { phase: String(d.phase).trim() } : {}),
      ...(String(d?.rank_batch ?? "").trim() ? { rank_batch: String(d.rank_batch).trim() } : {}),
      ...(d?.audience === "candidate" || d?.audience === "institute" ? { audience: String(d.audience) } : {}),
      isUrgent: kind === "registration_start" || kind === "registration_end" || kind === "choice_filling" || kind === "fee_last_date" || kind === "institute_lock",
      state: TENTATIVE_SIGNALS.test(label + " " + dateText) ? "expected" : "confirmed",
      verified: false,
      source_quote: quote,
      confidence: typeof d?.confidence === "number" ? Math.min(1, Math.max(0, d.confidence)) : 0,
    });
  }

  // references (S2.6): document references, dates parsed the same way.
  const references: PipelineResult["references"] = [];
  const rawRefs = Array.isArray(parsed.references) ? (parsed.references as Record<string, unknown>[]) : [];
  for (const r of rawRefs) {
    const label = String(r?.label ?? "").trim();
    if (!label) continue;
    const date = parseDateWindow(String(r?.dateText ?? ""), year).date;
    references.push({ label, date, sourceQuote: String(r?.sourceQuote ?? "") });
  }

  return { fields, rows, references, rejected, warnings };
}
