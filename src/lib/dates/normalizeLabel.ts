/**
 * normalizeLabel.ts — THE single source for label → date-type/state inference.
 *
 * Pure, dependency-free. Extracted from entranceExamAI.ts so it can be shared by
 * AI Fill, Excel import, and the import preview WITHOUT dragging the Gemini SDK
 * into those bundles. entranceExamAI.ts re-exports from here; do not fork the logic.
 */

/** Full date row shape including the Step-2 metadata fields. */
export interface NormalizedDate {
  label: string;
  isUrgent: boolean;
  type: string;
  stage_label: string;
  /** 'expected' when the source text signals the date is tentative/provisional */
  state: "confirmed" | "expected";
}

/** Words in a raw label that signal the date is tentative, not officially confirmed. */
export const TENTATIVE_SIGNALS = /tentative|expected|approximate|provisional|likely|tba|to be announced|probable/i;

export function normalizeLabel(rawLabel: string): NormalizedDate | null {
  const l = rawLabel.toLowerCase().trim();
  const state: "confirmed" | "expected" = TENTATIVE_SIGNALS.test(rawLabel) ? "expected" : "confirmed";

  if (/registration\s*(open|start|begin|window\s*open)|start\s*of\s*submission|application\s*(start|open|begin)/i.test(l))
    return { label: "Registration Opens",              isUrgent: true,  type: "application_start", stage_label: "", state };
  if (/registration\s*(close|end|deadline)|last\s*date\s*(for|of)\s*(submission|application|submitting)|application\s*(close|end|deadline)/i.test(l))
    return { label: "Registration Closes",             isUrgent: true,  type: "application_end",   stage_label: "", state };
  if (/last\s*date\s*(for|of)\s*(fee|payment)|fee\s*(deadline|last\s*date)/i.test(l))
    return { label: "Registration Closes",             isUrgent: true,  type: "application_end",   stage_label: "", state };
  if (/exam\s*date|test\s*day|test\s*date|date\s*of\s*exam/i.test(l))
    return { label: "Exam Date",                       isUrgent: true,  type: "exam_written",      stage_label: "", state };
  if (/admit\s*card|hall\s*ticket|download\s*admit/i.test(l))
    return { label: "Admit Card Release",              isUrgent: false, type: "admit_card",         stage_label: "", state };
  if (/answer\s*key|objection/i.test(l))
    return { label: "Answer Key Release",              isUrgent: false, type: "answer_key",         stage_label: "", state };
  if (/result|score\s*card|declaration\s*of\s*result/i.test(l))
    return { label: "Result Declaration",              isUrgent: false, type: "result",             stage_label: "", state };
  if (/notification|bulletin|advertisement/i.test(l))
    return { label: "Notification Release",            isUrgent: false, type: "notification",       stage_label: "", state };
  if (/correction|edit\s*application|modify|online\s*correction/i.test(l))
    return { label: "Application Correction Window",   isUrgent: false, type: "correction_window",  stage_label: "", state };
  if (/counsel/i.test(l))
    return { label: "Counselling Starts",              isUrgent: false, type: "counselling",        stage_label: "", state };
  if (/cut\s*off/i.test(l))
    return { label: "Cutoff Release",                  isUrgent: false, type: "result",             stage_label: "", state };
  if (/score\s*validity/i.test(l)) return null; // not a date we track
  if (/last\s*date/i.test(l))
    return { label: "Registration Closes",             isUrgent: true,  type: "application_end",   stage_label: "", state };

  return null;
}
