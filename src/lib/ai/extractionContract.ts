/**
 * extractionContract.ts — S2.1 options-aware extraction contract.
 *
 * The rule the D.El.Ed failure forced (docs/design/admission-counselling-model.md
 * §15.1): the model must never be able to invent a dropdown value. At call time
 * the allowed options (categories by pillar, regions, entity types, selection
 * models) are read from the DB/registry and handed to the prompt; EVERY field in
 * the response then carries:
 *
 *   { value, confidence 0–1, sourceQuote }
 *
 * A dropdown is filled ONLY when confidence ≥ OPTION_CONFIDENCE_FLOOR (0.7)
 * AND the value is one of the allowed options. Anything else is left EMPTY and
 * FLAGGED — with an optional suggestedNewOption so a genuinely missing category
 * becomes a CMS to-do instead of a wrong guess.
 *
 * `entityType` and `selectionModel` additionally carry a `reason` (e.g. "no
 * written test; admission by state merit rank" → merit-based) so the review
 * drawer (S2.4) can show WHY, not just WHAT.
 *
 * Pure and dependency-free: the Edge Function (S2.3) builds on the same shapes,
 * the client validates against them, and the golden test (S2.7) asserts them.
 */

/** A single proposed field value with its trust metadata. */
export interface FieldProposal<T = string> {
  /** The model's value; null/empty when it found nothing. */
  value: T | null;
  /** 0–1. Below the floor the value is never applied. */
  confidence: number;
  /** Verbatim words from the accepted source (never a paraphrase). */
  sourceQuote: string;
  /** Why this option was chosen — required for entityType/selectionModel. */
  reason?: string;
  /** When the right value is NOT in the allowed list, what should be added. */
  suggestedNewOption?: string;
}

/** The vocabulary the model may choose dropdown values FROM, read at call time. */
export interface AllowedOptions {
  /** categories table, filtered by pillar: slug is the value, name the label. */
  categories: { slug: string; name: string }[];
  /** regions table: slug value, human label. */
  regions: { slug: string; label: string }[];
  /** moduleRegistry vocabulary (entity_type axis), already pillar-narrowed. */
  entityTypes: string[];
  /** types/selection vocabulary (selection_model axis). */
  selectionModels: string[];
}

/** Below this, an option is left empty and flagged — never guessed. */
export const OPTION_CONFIDENCE_FLOOR = 0.7;

export type OptionFlagReason =
  | "no_value"          // the source simply did not say
  | "low_confidence"    // a value exists but trust is below the floor
  | "not_an_option";    // a value exists but the CMS has no such option

export interface ResolvedOption {
  /** What to WRITE into the field — "" when the proposal was rejected. */
  value: string;
  /** True unless the value was accepted outright. */
  flagged: boolean;
  reason?: OptionFlagReason;
  /** "option X is not in the list; add it?" — carried to the fill report. */
  suggestedNewOption?: string;
  confidence: number;
  sourceQuote: string;
}

/**
 * Apply the contract to ONE dropdown field. Membership is an exact match on
 * the option VALUE (slug), case-insensitively — display labels never decide.
 */
export function resolveOption(
  proposal: FieldProposal | null | undefined,
  allowed: readonly string[],
): ResolvedOption {
  const value = (proposal?.value ?? "").toString().trim();
  const confidence = typeof proposal?.confidence === "number" ? proposal.confidence : 0;
  const sourceQuote = proposal?.sourceQuote?.trim() ?? "";

  if (!value) {
    return { value: "", flagged: true, reason: "no_value", confidence, sourceQuote };
  }
  const lower = value.toLowerCase();
  const match = allowed.find((a) => a.toLowerCase() === lower);
  if (confidence < OPTION_CONFIDENCE_FLOOR) {
    return {
      value: "", flagged: true, reason: "low_confidence",
      suggestedNewOption: match ? undefined : proposal?.suggestedNewOption?.trim() || undefined,
      confidence, sourceQuote,
    };
  }
  if (!match) {
    return {
      value: "", flagged: true, reason: "not_an_option",
      suggestedNewOption: proposal?.suggestedNewOption?.trim() || value,
      confidence, sourceQuote,
    };
  }
  return { value: match, flagged: false, confidence, sourceQuote };
}

/** Per-field verdicts for one extraction, keyed by field name. */
export type ResolvedFields = Record<
  string,
  { value: string; flagged: boolean; reason?: OptionFlagReason; confidence: number; sourceQuote: string; suggestedNewOption?: string; reasonNote?: string }
>;

/**
 * Validate a whole draft response against the allowed options. Fields absent
 * from the proposal simply stay unfilled — the review drawer (S2.4) shows them
 * in the "skipped" part of the fill report, not as errors.
 */
export function resolveDraftFields(draft: Record<string, FieldProposal | null | undefined>, allowed: AllowedOptions): ResolvedFields {
  const out: ResolvedFields = {};
  const entries: [string, readonly string[]][] = [
    ["categorySlug", allowed.categories.map((c) => c.slug)],
    ["region", allowed.regions.map((r) => r.slug)],
    ["entityType", allowed.entityTypes],
    ["selectionModel", allowed.selectionModels],
  ];
  for (const [field, options] of entries) {
    const proposal = draft[field];
    if (proposal === undefined) continue;
    const resolved = resolveOption(proposal, options);
    out[field] = {
      value: resolved.value,
      flagged: resolved.flagged,
      reason: resolved.reason,
      confidence: resolved.confidence,
      sourceQuote: resolved.sourceQuote,
      suggestedNewOption: resolved.suggestedNewOption,
      reasonNote: proposal?.reason,
    };
  }
  return out;
}

/**
 * Enforcement for FLAT legacy responses (autofill.ts's generic JSON and pasted
 * JSON, which carry no per-field confidence): membership only. A value outside
 * its allowed list is DROPPED from the draft and reported in `flags`, so the
 * caller can neither save a made-up slug nor lose the fact silently.
 */
export interface FieldFlag {
  field: string;
  reason: OptionFlagReason;
  rejectedValue?: string;
  suggestedNewOption?: string;
}

export function enforceOptionsOnDraft<T extends Record<string, unknown>>(
  draft: T,
  allowed: AllowedOptions,
): { draft: T; flags: FieldFlag[] } {
  const out: Record<string, unknown> = { ...draft };
  const flags: FieldFlag[] = [];
  const checks: [string, readonly string[]][] = [
    ["categorySlug", allowed.categories.map((c) => c.slug)],
    ["region", allowed.regions.map((r) => r.slug)],
    ["entityType", allowed.entityTypes],
    ["selectionModel", allowed.selectionModels],
  ];
  for (const [field, options] of checks) {
    const v = out[field];
    if (typeof v !== "string" || !v.trim()) continue;
    const lower = v.trim().toLowerCase();
    const match = options.find((o) => o.toLowerCase() === lower);
    if (match) {
      out[field] = match; // normalise case to the canonical option
      continue;
    }
    flags.push({ field, reason: "not_an_option", rejectedValue: v.trim(), suggestedNewOption: typeof out.suggestedNewOption === "string" ? out.suggestedNewOption : undefined });
    delete out[field];
  }
  return { draft: out as T, flags };
}
