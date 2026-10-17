/**
 * pillarAdminLists.ts — which CMS sidebar list a pillar's records live in, and its
 * human label. Used by the duplicate-record toast (EntranceExamEditorPage) so the
 * message can name WHERE the existing record is and link to the CORRECT list — an
 * entrance-exam create can collide with a government-exam record, so the editor's
 * own listPath would point at the wrong place.
 *
 * The `path` values match the list routes the editor derives for back-navigation
 * (EntranceExamEditorPage `listPath`).
 */
export interface AdminList { path: string; label: string; }

const PILLAR_ADMIN_LIST: Record<string, AdminList> = {
  "entrance-exam":     { path: "/entrance-exams",    label: "Entrance Exams" },
  "government-exam":   { path: "/govt-exam",         label: "Govt Exams" },
  "sarkari-naukri":    { path: "/govt-exam",         label: "Govt Exams" },
  "govt-vacancy":      { path: "/govt-vacancy",      label: "Govt Vacancy Exams" },
  "sarkari-bharti":    { path: "/govt-vacancy",      label: "Govt Vacancy Exams" },
  "board-exam":        { path: "/board-exams",       label: "Board Exams" },
  "board-university":  { path: "/board-exams",       label: "Board Exams" },
  "university-exam":   { path: "/university-exams",  label: "University Exams" },
  "university-admission": { path: "/university-exams", label: "University Exams" },
};

const FALLBACK: AdminList = { path: "/entrance-exams", label: "Entrance Exams" };

/** The admin sidebar list for a pillar; falls back to Entrance Exams for unknown. */
export function adminListForPillar(pillar?: string | null): AdminList {
  return (pillar && PILLAR_ADMIN_LIST[pillar]) || FALLBACK;
}
