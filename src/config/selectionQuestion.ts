/**
 * selectionQuestion.ts — R2.2: the ONE "How are candidates selected?" question.
 *
 * This replaces the two separate pickers the old Identity tab showed
 * ("Entity Type" + "Selection Model *"). A single answer sets BOTH axes at
 * once — the entity type (what the record IS) and the selection model (HOW a
 * candidate is chosen) — as a matched pair, so the two can never disagree the
 * way two independent dropdowns could.
 *
 * Design rules (owner decision 17 Oct 2026):
 *  - NO DEFAULT. The picker starts on "— Select —"; a record cannot be
 *    published until the question is answered. (Save's own required-model check
 *    already blocks saving an answer; the Publish gate is added on top of it.)
 *  - EVERY label lives here, in plain words a tier-2/3 editor understands. No
 *    exam names ("GATE"), no technical slug ("internal-admission") in a label —
 *    the technical names are only ever VALUES, never the text shown. Reword the
 *    question by editing this file alone; the UI reads nothing but these fields.
 *  - The pillar decides the entity type for every pillar EXCEPT entrance-exam.
 *    For a fixed pillar the answer only narrows the selection model, and only
 *    the models that are legal for that entity type are offered (3 or 4). For
 *    entrance-exam the answer also chooses exam vs university-admission, so the
 *    pillar shows a curated set of six plain-language answers.
 */
import {
  entityTypeForPillar,
  type EntityType,
} from "@/config/moduleRegistry";
import { ALL_SELECTION_MODELS, type SelectionModel } from "@/types/selection";

/** One selectable answer. Picking it writes the whole (entityType, selectionModel) pair. */
export interface SelectionAnswer {
  /** Stable id used as the <option value>. Derived from the pair, never hand-typed. */
  id: string;
  /** Axis 1 — the entity type this answer selects. */
  entityType: EntityType;
  /** Axis 2 — the selection model this answer selects. */
  selectionModel: SelectionModel;
  /** Plain-words label shown in the picker. No jargon, no exam names. */
  label: string;
  /** Plain-words helper shown under the picker for the chosen answer. */
  hint: string;
}

/** The question the editor answers. */
export const SELECTION_QUESTION = "How are candidates selected?";

/** The placeholder option text — the "no default" state. */
export const SELECTION_UNANSWERED_LABEL = "— Select —";

// ── Plain-word labels/hints for the four selection models ────────────────────
// Kept separate from types/selection.ts's SELECTION_MODEL_LABELS (which carries
// the "Interview / GATE-Score" jargon) on purpose: this file owns the EDITOR-
// FACING wording and must never show a technical name or an exam acronym.
const MODEL_LABEL: Record<SelectionModel, string> = {
  "written-exam": "A written exam",
  "merit-based": "A merit list",
  "interview-based": "An interview or an existing score",
  "internal-admission": "The institution's own process",
};

const MODEL_HINT: Record<SelectionModel, string> = {
  "written-exam": "Candidates sit a written test.",
  "merit-based": "Selected by marks or a merit list — no written test.",
  "interview-based": "Selected by interview, or by a score they already hold.",
  "internal-admission": "The college or university allots seats in its own way.",
};

/**
 * Which selection models are legal for each entity type.
 *
 * `internal-admission` means "the institution runs its own admission" — it is
 * only ever true for a university admission. Every entity type can be filled by
 * a written test, a merit list, or an interview/score, so the other three are
 * legal everywhere. This is the rule the fixed pillars read to decide how many
 * (3 or 4) answers to show.
 */
export const LEGAL_MODELS_BY_ENTITY: Record<EntityType, SelectionModel[]> = {
  exam: ["written-exam", "merit-based", "interview-based"],
  recruitment: ["written-exam", "merit-based", "interview-based"],
  board: ["written-exam", "merit-based", "interview-based"],
  "university-exam": ["written-exam", "merit-based", "interview-based"],
  "university-admission": ["written-exam", "merit-based", "interview-based", "internal-admission"],
};

/** The pair→id used both to build and to look up an answer. Never hand-typed. */
export function answerIdFor(entityType: string, selectionModel: string): string {
  return `${entityType}--${selectionModel}`;
}

function makeAnswer(entityType: EntityType, selectionModel: SelectionModel, label: string, hint: string): SelectionAnswer {
  return { id: answerIdFor(entityType, selectionModel), entityType, selectionModel, label, hint };
}

/**
 * The six entrance-exam answers. Entrance-exam is the only pillar where the
 * editor also chooses the entity type (a competitive exam vs a university
 * admission), so each answer names both in plain words. This is a CURATED set
 * (not exam×models + admission×models) chosen for clarity; every pair it names
 * is still legal under LEGAL_MODELS_BY_ENTITY.
 */
export const ENTRANCE_EXAM_ANSWERS: SelectionAnswer[] = [
  makeAnswer("exam", "written-exam",
    "Entrance exam — candidates sit a written test",
    "A test the candidate takes, like JEE, NEET or CAT."),
  makeAnswer("exam", "merit-based",
    "Entrance exam — selection by marks or merit",
    "Chosen on exam or class marks, with no separate written test."),
  makeAnswer("exam", "interview-based",
    "Entrance exam — selection by interview or an existing score",
    "A personal interview, or a score the candidate already holds."),
  makeAnswer("university-admission", "written-exam",
    "University admission — the university's own written test",
    "A test the university conducts, like CUET."),
  makeAnswer("university-admission", "merit-based",
    "University admission — on marks or merit",
    "Seats given on the candidate's marks, with no test."),
  makeAnswer("university-admission", "internal-admission",
    "University admission — the institution's own process",
    "Counselling and seat allotment handled by the institution."),
];

/**
 * The answers a pillar offers. A fixed pillar shows one answer per legal
 * selection model for its fixed entity type (3 or 4); entrance-exam shows the
 * curated six. Order is stable: the order LEGAL_MODELS_BY_ENTITY lists, or the
 * ENTRANCE_EXAM_ANSWERS order.
 */
export function answersForPillar(pillar: string): SelectionAnswer[] {
  const fixed = entityTypeForPillar(pillar);
  if (fixed !== null) {
    return LEGAL_MODELS_BY_ENTITY[fixed].map((m) =>
      makeAnswer(fixed, m, MODEL_LABEL[m], MODEL_HINT[m]),
    );
  }
  return ENTRANCE_EXAM_ANSWERS;
}

/**
 * The answer id currently selected for a record's (entity type, selection
 * model), or "" when unanswered/unknown — used to preselect the picker when an
 * existing record loads. Returns "" unless the pair is actually offered by this
 * pillar, so a stale pair never shows a phantom selection.
 */
export function selectedAnswerId(pillar: string, entityType: string, selectionModel: string): string {
  if (!selectionModel) return "";
  const match = answersForPillar(pillar).find(
    (a) => a.entityType === entityType && a.selectionModel === selectionModel,
  );
  return match?.id ?? "";
}

/** Is the question answered? Anything other than a real, offered selection model is "no". */
export function isSelectionAnswered(selectionModel: unknown): boolean {
  return typeof selectionModel === "string"
    && (ALL_SELECTION_MODELS as string[]).includes(selectionModel);
}

/** The helper text for the current answer, or the plain prompt to answer. */
export function selectionHelperText(pillar: string, entityType: string, selectionModel: string): string {
  const id = selectedAnswerId(pillar, entityType, selectionModel);
  const answer = answersForPillar(pillar).find((a) => a.id === id);
  return answer
    ? answer.hint
    : "Choose how candidates are selected. This decides which sections apply and is needed before publishing.";
}
