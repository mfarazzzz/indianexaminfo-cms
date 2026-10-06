/**
 * normalizeLabel.ts — THE single source for label → date-type/kind/state inference.
 *
 * Pure, dependency-free. Shared by AI Fill, Excel import, and the import preview
 * WITHOUT dragging the Gemini SDK into those bundles. entranceExamAI.ts
 * re-exports from here; do not fork the logic.
 *
 * S2.2 — TWO-VOCABULARY CONTRACT (owner-approved, 2026-10-06):
 *  • `type` is the VIEW's vocabulary. exam_derived_status reads d->>'type' and
 *    filters on exactly: application_start, application_end, notification,
 *    admit_card, answer_key, result, merit_list, counselling, exam_written,
 *    exam_practical, exam_physical, exam_city_intimation, interview, walkin,
 *    other. NEVER invent a new type value — anything the VIEW does not know
 *    must ride as `type: "other"`. No VIEW change ships with S2.
 *  • `kind` is the FINE-GRAINED event (registration_end, choice_filling,
 *    allotment, …). It is additive display/merge metadata — the frontend and
 *    the site ignore it until S3 renders it, so it cannot break status.
 *  • UNKNOWN LABELS ARE KEPT. normalizeLabel never returns null: an
 *    unrecognised label becomes a custom row (type "other", kind "other")
 *    with the SOURCE label preserved. Dropping events the pipeline doesn't
 *    know yet was the Phase-3 failure (every counselling row discarded).
 *  • extension is NOT a type/kind of its own event — the new row carries
 *    kind "extension" plus a `supersedes` link to the row it replaces
 *    (the link itself is set by the match-and-update merge, S2.5).
 */

/** A persisted date-row kind. Open string union: kinds are additive, typed here
 *  for discoverability; unknown labels use "other". */
export type DateEventKind =
  | "registration_start" | "registration_end" | "fee_last_date" | "print_last_date"
  | "correction_window" | "notification" | "extension" | "rank_release" | "merit_list"
  | "choice_filling" | "allotment" | "document_verification" | "admission"
  | "institute_lock" | "session_start" | "counselling" | "cutoff"
  | "admit_card" | "answer_key" | "result"
  | "exam_written" | "exam_practical" | "exam_physical" | "exam_city_intimation"
  | "interview" | "walkin" | "other";

/** Full date row shape including the Step-2 metadata fields. */
export interface NormalizedDate {
  /** Canonical English label for known kinds; the SOURCE label for custom rows. */
  label: string;
  isUrgent: boolean;
  /** VIEW vocabulary only — see the contract above. */
  type: string;
  /** Fine-grained event; "other" for unrecognised labels. */
  kind: DateEventKind;
  stage_label: string;
  /** 'expected' when the source text signals the date is tentative/provisional */
  state: "confirmed" | "expected";
  /** true when the label matched no known pattern (custom row, source label kept) */
  custom: boolean;
}

/** Words in a raw label that signal the date is tentative, not officially confirmed. */
export const TENTATIVE_SIGNALS = /tentative|expected|approximate|provisional|likely|tba|to be announced|probable/i;

/** One pattern → (kind, VIEW type, canonical label, urgency). Order in the
 *  table below is the match order: most specific first. */
interface KindRule {
  kind: DateEventKind;
  type: string;
  label: string;
  isUrgent: boolean;
  test: RegExp;
  /** When present, BOTH `test` and `and` must match (two-word events like
   *  "Institution … lock/freeze" that no single contiguous regex can catch). */
  and?: RegExp;
}

const KIND_RULES: KindRule[] = [
  // ── Counselling-round events (specific first — "Choice Filling registration"
  //    must not be swallowed by the registration patterns below) ──────────────
  { kind: "choice_filling",        type: "counselling",      label: "Choice Filling Window",        isUrgent: true,  test: /choice\s*(filling|fill|registration|option|locking)|option\s*(filling|registration)/i },
  { kind: "allotment",             type: "counselling",      label: "Seat Allotment",               isUrgent: false, test: /allot/i },
  { kind: "institute_lock",        type: "counselling",      label: "Institution Lock",             isUrgent: true,  test: /institute|institution/i, and: /lock|freeze|freez|clos/i },
  { kind: "document_verification", type: "counselling",      label: "Document Verification",        isUrgent: false, test: /document\s*verif|verification|reporting\s*(round|cum|window|date|and)|\breporting\b/i },
  { kind: "admission",             type: "counselling",      label: "Admission",                    isUrgent: false, test: /admission/i },
  { kind: "rank_release",          type: "merit_list",       label: "State Rank Release",           isUrgent: false, test: /rank/i },
  { kind: "merit_list",            type: "merit_list",       label: "Merit List",                   isUrgent: false, test: /merit\s*list|selectee|selection\s*list|finali[sz]ed/i },
  { kind: "counselling",           type: "counselling",      label: "Counselling Starts",           isUrgent: false, test: /counsel|josaa/i },
  { kind: "session_start",         type: "other",            label: "Session Start",                isUrgent: false, test: /(session|class|college|academic)\s*(start|commenc|open)/i },

  // ── Application-window events ───────────────────────────────────────────────
  { kind: "correction_window",     type: "other",            label: "Application Correction Window", isUrgent: false, test: /correction|edit\s*application|modify/i },
  { kind: "fee_last_date",         type: "other",            label: "Fee Payment Last Date",        isUrgent: true,  test: /(fee|payment)[a-z\s]*(last|dead|due|close|end|upto)|last\s*date[a-z\s]*(fee|payment)/i },
  { kind: "print_last_date",       type: "other",            label: "Certificate Print Last Date",  isUrgent: false, test: /print|certificate[a-z\s]*(download|issue)/i },
  { kind: "registration_start",    type: "application_start", label: "Registration Opens",          isUrgent: true,  test: /registration\s*(open|start|begin|window)|start\s*of\s*submission|application\s*(start|open|begin)/i },
  { kind: "registration_end",      type: "application_end",   label: "Registration Closes",         isUrgent: true,  test: /registration\s*(close|end|deadline)|last\s*date.*(submission|applic|form)|apply\s*end|application\s*(close|end|deadline)|last\s*date/i },

  // ── Written-exam lifecycle (unchanged VIEW vocabulary) ──────────────────────
  { kind: "exam_city_intimation",  type: "exam_city_intimation", label: "Exam City Intimation",     isUrgent: false, test: /exam\s*city|city\s*intim/i },
  { kind: "admit_card",            type: "admit_card",        label: "Admit Card Release",           isUrgent: false, test: /admit\s*card|hall\s*ticket|download\s*admit/i },
  { kind: "answer_key",            type: "answer_key",        label: "Answer Key Release",           isUrgent: false, test: /answer\s*key|objection/i },
  { kind: "exam_physical",         type: "exam_physical",     label: "Physical Test",                isUrgent: false, test: /physical|pet\b|rally/i },
  { kind: "exam_practical",        type: "exam_practical",    label: "Practical Exam",               isUrgent: false, test: /practical/i },
  { kind: "interview",             type: "interview",         label: "Interview",                    isUrgent: false, test: /interview|personality\s*test/i },
  { kind: "walkin",                type: "walkin",            label: "Walk-in Drive",                isUrgent: false, test: /walk[\s-]*in/i },
  { kind: "exam_written",          type: "exam_written",      label: "Exam Date",                    isUrgent: true,  test: /exam|test\s*(day|date)|prelims|mains|written|date\s*of\s*(exam|test)/i },

  // ── Post-exam ───────────────────────────────────────────────────────────────
  // S2.2 FIX: cut-off was typed "result" and wrongly drove result_confirmed.
  // Checked BEFORE result so "Cutoff / Result" trends to the safe cutoff type.
  { kind: "cutoff",                type: "cutoff",            label: "Cutoff Release",               isUrgent: false, test: /cut[\s-]*off/i },
  { kind: "result",                type: "result",            label: "Result Declaration",           isUrgent: false, test: /result|score\s*card/i },
  { kind: "notification",          type: "notification",      label: "Notification Release",         isUrgent: false, test: /notification|bulletin|advertisement|vigyapti|ad\s*dated/i },
];

/**
 * "Extended …" rows supersede an earlier row rather than being a new event.
 * The VIEW type follows WHAT was extended (registration/application → the
 * application deadline); kind is always "extension" and the caller links the
 * superseded row via `supersedes` (S2.5 merge).
 */
function extensionResult(rawLabel: string, state: "confirmed" | "expected"): NormalizedDate {
  const extendsApplication = /registration|application|form|submission|apply/i.test(rawLabel);
  return {
    label: rawLabel.trim(),           // source label kept — it says what was extended
    isUrgent: extendsApplication,
    type: extendsApplication ? "application_end" : "other",
    kind: "extension",
    stage_label: "",
    state,
    custom: false,
  };
}

/**
 * Map ANY label to a date row. NEVER returns null — an unknown label becomes
 * a custom row with the source label preserved (type "other", kind "other").
 */
export function normalizeLabel(rawLabel: string): NormalizedDate {
  const trimmed = (rawLabel ?? "").trim();
  const state: "confirmed" | "expected" = TENTATIVE_SIGNALS.test(rawLabel ?? "") ? "expected" : "confirmed";

  if (!trimmed) {
    return { label: "", isUrgent: false, type: "other", kind: "other", stage_label: "", state, custom: true };
  }

  // NB: "Extension" does NOT contain "extend" (it is "extens"+"ion") — match
  // both stems. Hindi: "समय/अवधि बढ़" (time extended). JS \b is ASCII-only.
  if (/extend|extens|(?:समय|तिथि|अवधि)\s*बढ़/i.test(trimmed)) return extensionResult(trimmed, state);

  for (const rule of KIND_RULES) {
    if (rule.test.test(trimmed) && (!rule.and || rule.and.test(trimmed))) {
      return {
        label: rule.label,
        isUrgent: rule.isUrgent,
        type: rule.type,
        kind: rule.kind,
        stage_label: "",
        state,
        custom: false,
      };
    }
  }

  // Unknown label → custom row. The source label is KEPT verbatim; it is data,
  // not noise. Rendered/editor-reviewed in S3; rides the pass-through contract.
  return {
    label: trimmed,
    isUrgent: false,
    type: "other",
    kind: "other",
    stage_label: "",
    state,
    custom: true,
  };
}
