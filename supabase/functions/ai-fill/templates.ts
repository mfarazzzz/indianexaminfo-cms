// templates.ts — server-side extraction templates for the ai-fill function
// (S2.3). The browser sends { template, sourceText } — NEVER a prompt — so a
// caller who passes the permission check can no longer use this endpoint as a
// general model proxy, and the extraction contract cannot drift per-client.
//
// The one template today: NOTICE_EXTRACT_V1 — "update from a notice". It
// implements the S2.1 options-aware contract SERVER-SIDE: the allowed dropdown
// vocabulary (categories by pillar, regions, entity types, selection models) is
// read from the database at call time and embedded in the prompt, and the raw
// model answer is validated against the same lists before anything is returned.
//
// The response schema gives EVERY field { value, confidence 0–1, sourceQuote }.
// A field whose value is not an allowed option, or whose confidence is below
// the floor, is emptied and reported in `issues` — never silently applied.
// Date rows use the S2.2 two-vocabulary contract: `type` is the VIEW's
// vocabulary (exam_derived_status), `kind` is the fine-grained event, and
// unknown labels are KEPT as custom rows — the prompt says so explicitly, and
// the validator enforces the type list.
//
// Mirrors of platform constants — keep in sync (guarded by
// src/lib/ai/noticeTemplateParity.test.ts, which reads this file):
//   ENTITY_TYPES          ← src/config/moduleRegistry.ts ALL_ENTITY_TYPES
//   PILLAR_ENTITY_TYPE    ← moduleRegistry entityTypeForPillar
//   SELECTION_MODELS      ← src/types/selection.ts ALL_SELECTION_MODELS
//   DATE_TYPES            ← src/lib/dates/normalizeLabel.ts (VIEW vocabulary)
//   OPTION_CONFIDENCE_FLOOR ← src/lib/ai/extractionContract.ts

export const TEMPLATES = ["NOTICE_EXTRACT_V1"] as const;
export type TemplateName = (typeof TEMPLATES)[number];

const OPTION_CONFIDENCE_FLOOR = 0.7;

const ENTITY_TYPES = ["exam", "board", "university-admission", "recruitment", "university-exam"];
const PILLAR_ENTITY_TYPE: Record<string, string | null> = {
  "government-exam": "recruitment",
  "govt-vacancy": "recruitment",
  "sarkari-naukri": "recruitment",
  "board-exam": "board",
  "board-university": "board",
  "university-exam": "university-exam",
  "university-admission": "university-admission",
  "entrance-exam": null, // the only pillar with a genuine choice
};
const ENTRANCE_EXAM_CHOICES = ["exam", "university-admission"];
const SELECTION_MODELS = ["written-exam", "merit-based", "interview-based", "internal-admission"];
/** The exam_derived_status VIEW's vocabulary — types OUTSIDE this list are
 *  rejected (the model must use `other` for anything finer; `kind` carries it). */
const DATE_TYPES = [
  "application_start", "application_end", "notification", "admit_card", "answer_key",
  "result", "merit_list", "counselling", "exam_written", "exam_practical", "exam_physical",
  "exam_city_intimation", "interview", "walkin", "cutoff", "other",
];
const DATE_KINDS = [
  "registration_start", "registration_end", "fee_last_date", "print_last_date",
  "correction_window", "notification", "extension", "rank_release", "merit_list",
  "choice_filling", "allotment", "document_verification", "admission", "institute_lock",
  "session_start", "counselling", "cutoff", "admit_card", "answer_key", "result",
  "exam_written", "exam_practical", "exam_physical", "exam_city_intimation",
  "interview", "walkin", "other",
];

export interface AllowedOptionsServer {
  categories: { slug: string; name: string }[];
  regions: { slug: string; label: string }[];
  entityTypes: string[];
  selectionModels: string[];
}

/** Read the live option vocabulary. Called per template request with the
 *  function's own admin client — the browser never sends (or sees) this list. */
export async function loadOptions(admin: { from: (t: string) => any }, pillar?: string): Promise<AllowedOptionsServer> {
  let catQ = admin.from("categories").select("slug,name").eq("is_active", true).order("order_index");
  if (pillar) catQ = catQ.eq("pillar", pillar);
  const [{ data: cats }, { data: regs }] = await Promise.all([
    catQ,
    admin.from("regions").select("slug,label").order("label"),
  ]);
  const fixed = pillar ? PILLAR_ENTITY_TYPE[pillar] ?? "exam" : null;
  return {
    categories: (cats ?? []) as AllowedOptionsServer["categories"],
    regions: (regs ?? []) as AllowedOptionsServer["regions"],
    entityTypes: fixed ? [fixed] : pillar === "entrance-exam" ? [...ENTRANCE_EXAM_CHOICES] : [...ENTITY_TYPES],
    selectionModels: [...SELECTION_MODELS],
  };
}

/** The extraction prompt. sourceText arrives WHOLE — no 5,000/3,500 slicing;
 *  the function's own cap guards runaway input. */
export function buildPrompt(template: TemplateName, sourceText: string, opts: AllowedOptionsServer): string {
  if (template !== "NOTICE_EXTRACT_V1") throw new Error(`unknown template ${template}`);
  const cats = opts.categories.map((c) => `"${c.slug}" (${c.name})`).join(", ") || "(none)";
  const regs = opts.regions.map((r) => `"${r.slug}"`).join(", ");
  return `You are extracting structured data from ONE official Indian exam/admission notice. Use ONLY the text between the markers. Copy date text EXACTLY as written (the platform parses Indian and Hindi formats itself — do NOT reformat).

ALLOWED OPTIONS (read from the CMS database right now — choose ONLY from these):
- categorySlug: ${cats}
- region: ${regs}
- entityType: ${opts.entityTypes.map((t) => `"${t}"`).join(", ")}
- selectionModel: ${opts.selectionModels.map((m) => `"${m}"`).join(", ")}
If the right value is NOT in a list, set the value to "" and put the closest new name in "suggestedNewOption" — NEVER invent a slug.

Return ONLY one valid JSON object, exactly this shape:
{
  "fields": {
    "name":            { "value": "official exam/admission name incl. year", "confidence": 0-1, "sourceQuote": "verbatim words from the notice" },
    "shortName":       { "value": "abbreviation", "confidence": 0-1, "sourceQuote": "..." },
    "categorySlug":    { "value": "one of the allowed categories", "confidence": 0-1, "sourceQuote": "...", "suggestedNewOption": "" },
    "region":          { "value": "one of the allowed regions", "confidence": 0-1, "sourceQuote": "..." },
    "entityType":      { "value": "one of the allowed entity types", "confidence": 0-1, "sourceQuote": "...", "reason": "one plain line: WHY (e.g. 'state counselling admission, not a national entrance test')" },
    "selectionModel":  { "value": "one of the allowed selection models", "confidence": 0-1, "sourceQuote": "...", "reason": "one plain line: WHY (e.g. 'no written test; admission by state merit rank')" },
    "conductingBody":  { "value": "...", "confidence": 0-1, "sourceQuote": "..." },
    "officialWebsite": { "value": "URL exactly as printed", "confidence": 0-1, "sourceQuote": "..." },
    "eligibility":     { "value": "conditions as printed, incl. rank ranges and any 'not yet allotted'-type conditions", "confidence": 0-1, "sourceQuote": "..." },
    "fee":             { "value": "fee amounts with labels (application vs counselling/choice fee — keep them distinct)", "confidence": 0-1, "sourceQuote": "..." },
    "warnings":        { "value": "rules an applicant can breach (e.g. admission invalid without the institute lock)", "confidence": 0-1, "sourceQuote": "..." },
    "contacts":        { "value": "emails/phones as printed", "confidence": 0-1, "sourceQuote": "..." },
    "noticeReference": { "value": "the notice's own reference no. and date if printed", "confidence": 0-1, "sourceQuote": "..." }
  },
  "dates": [
    {
      "label": "event name as written (Hindi ok)",
      "dateText": "date/range EXACTLY as written: 05.10.2026; 05.10.2026 से 07.10.2026; 5 अक्टूबर 2026; include times like सायं 06:00 बजे or (अपराह्न)",
      "type": "one of: ${DATE_TYPES.join(", ")}",
      "kind": "one of: ${DATE_KINDS.join(", ")}",
      "phase": "e.g. Phase-3, or empty",
      "rank_batch": "e.g. 1–1,52,202, or empty",
      "audience": "candidate | institute | empty",
      "confidence": 0-1,
      "sourceQuote": "verbatim line(s) the date came from"
    }
  ]
}

DATE RULES (two-vocabulary contract — the site computes status from "type"):
- "type" is COARSE and fixed: registration opening → application_start; closing → application_end; choice filling / seat allotment / document verification / admission / institute lock → counselling; rank or merit list → merit_list; cut-off → cutoff (NOT result); fee/print/correction/session dates → other; exam-day rows → exam_written; admit_card / answer_key / result / notification keep their own type. Anything the list cannot express → "other".
- "kind" is the FINE-GRAINED event; put the specific name there (choice_filling, allotment, institute_lock, fee_last_date, …). Never invent a new "type".
- Every date in the notice gets a row — INCLUDE events you have no vocabulary for: use type "other", kind "other", and KEEP the label as written. Dropping a date is the worst failure.
- A date referenced only as background ("पूर्व प्रकाशित विज्ञप्ति दिनांक 07.08.2026") is NOT an event of THIS notice — leave it out of "dates".
- An extension of an earlier deadline: kind "extension", keep its label, one row.

NON-CONTENT: distribution lists ("प्रतिलिपि … District Magistrate / banks / DIET …"), salutations and letterhead are ADDRESSING metadata — never extract them into any field.

NOTICE TEXT:
<<<
${sourceText}
>>>`;
}

export interface Issue {
  field: string;
  reason: "low_confidence" | "not_an_option" | "bad_shape" | "no_value";
  detail: string;
}

const clamp01 = (v: unknown): number => (typeof v === "number" && isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Validate the model's raw answer BEFORE the browser sees it. Returns the
 * cleaned payload with per-field issues — a bad field is emptied, never
 * silently kept. Throws only when the answer is not JSON at all (the handler
 * turns that into a plain-words error the editor can act on).
 */
export function validateAnswer(parsed: unknown, opts: AllowedOptionsServer): { content: unknown; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!parsed || typeof parsed !== "object") throw new Error("model answer was not a JSON object");
  const root = parsed as Record<string, unknown>;
  const fields = (root.fields && typeof root.fields === "object") ? { ...(root.fields as Record<string, any>) } : {};
  if (!root.fields) issues.push({ field: "fields", reason: "bad_shape", detail: "the answer has no \"fields\" object" });

  const optionLists: Record<string, string[]> = {
    categorySlug: opts.categories.map((c) => c.slug),
    region: opts.regions.map((r) => r.slug),
    entityType: opts.entityTypes,
    selectionModel: opts.selectionModels,
  };
  for (const [name, list] of Object.entries(optionLists)) {
    const f = fields[name];
    if (!f) continue;
    const v = typeof f.value === "string" ? f.value.trim() : "";
    f.confidence = clamp01(f.confidence);
    if (!v) { f.value = ""; issues.push({ field: name, reason: "no_value", detail: "the notice did not state this" }); continue; }
    const match = list.find((o) => o.toLowerCase() === v.toLowerCase());
    if (!match || f.confidence < OPTION_CONFIDENCE_FLOOR) {
      if (!match) issues.push({ field: name, reason: "not_an_option", detail: `"${v}" is not in the CMS list` });
      else issues.push({ field: name, reason: "low_confidence", detail: `confidence ${f.confidence} is below ${OPTION_CONFIDENCE_FLOOR}` });
      f.value = ""; // empty + flagged — exactly the S2.1 rule, enforced here too
    } else {
      f.value = match;
    }
    fields[name] = f;
  }
  for (const [name, f] of Object.entries(fields) as [string, any][]) {
    if (optionLists[name]) continue;
    if (!f || typeof f !== "object" || typeof f.value !== "string") {
      issues.push({ field: name, reason: "bad_shape", detail: "missing {value, confidence, sourceQuote}" });
      continue;
    }
    f.confidence = clamp01(f.confidence);
    f.sourceQuote = typeof f.sourceQuote === "string" ? f.sourceQuote : "";
    fields[name] = f;
  }

  const rawDates = Array.isArray(root.dates) ? root.dates : [];
  if (!Array.isArray(root.dates)) issues.push({ field: "dates", reason: "bad_shape", detail: "the answer has no \"dates\" array" });
  const dates = rawDates.map((d: any, i: number) => {
    const row = {
      label: typeof d?.label === "string" ? d.label.trim() : "",
      dateText: typeof d?.dateText === "string" ? d.dateText.trim() : "",
      type: typeof d?.type === "string" && DATE_TYPES.includes(d.type) ? d.type : "other",
      kind: typeof d?.kind === "string" && DATE_KINDS.includes(d.kind) ? d.kind : "other",
      phase: typeof d?.phase === "string" ? d.phase.trim() : "",
      rank_batch: typeof d?.rank_batch === "string" ? d.rank_batch.trim() : "",
      audience: ["candidate", "institute"].includes(d?.audience) ? d.audience : "",
      confidence: clamp01(d?.confidence),
      sourceQuote: typeof d?.sourceQuote === "string" ? d.sourceQuote : "",
    };
    if (typeof d?.type === "string" && d.type && !DATE_TYPES.includes(d.type)) {
      issues.push({ field: `dates[${i}]`, reason: "not_an_option", detail: `type "${d.type}" is outside the status vocabulary — kept as "other" (kind preserved its meaning)` });
    }
    if (!row.label || !row.dateText) issues.push({ field: `dates[${i}]`, reason: "bad_shape", detail: "row missing label or dateText — dropped" });
    return row;
  }).filter((r: any) => r.label && r.dateText);

  return { content: { fields, dates }, issues };
}
