/**
 * selection.ts — Canonical SelectionModel type.
 *
 * Neutral file: neither moduleRegistry.ts nor the service layer owns this.
 * Import from here everywhere. Do NOT redefine this type elsewhere.
 * Mirrors the Postgres enum `selection_model` exactly.
 *
 * Axis 2: how a candidate is selected.
 * Axis 1 (what the entity is) lives in entity_type / EntityType.
 */

export type SelectionModel =
  | "written-exam"
  | "merit-based"
  | "interview-based"
  | "internal-admission";

export const ALL_SELECTION_MODELS: SelectionModel[] = [
  "written-exam",
  "merit-based",
  "interview-based",
  "internal-admission",
];

export const SELECTION_MODEL_LABELS: Record<SelectionModel, string> = {
  "written-exam":       "Written Exam",
  "merit-based":        "Merit-Based",
  "interview-based":    "Interview / GATE-Score",
  "internal-admission": "Internal Admission",
};

export const SELECTION_MODEL_HINTS: Record<SelectionModel, string> = {
  "written-exam":       "Candidates sit a written test. Admit card, answer key, cutoff apply.",
  "merit-based":        "Selection on marks, merit list, or physical/skill test. No written exam.",
  "interview-based":    "Selection by GATE score or interview panel. No exam conducted by this body.",
  "internal-admission": "Institution's own process — merit/counselling/seat allotment. No entrance test.",
};
