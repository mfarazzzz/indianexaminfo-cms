/**
 * standardDates.ts — Single source of truth for exam dates in the legacy `exams` editor.
 *
 * Track 2 decision (Option B): the date single-source-of-truth pattern is ported
 * from ELMS into the `exams` editor rather than migrating editors into ELMS.
 * See `.kiro/specs/legacy-exam-migration/track-2-elms-decision.md`.
 *
 * CANONICAL STORE: `exams.important_dates` (the form's `dates` array).
 *
 * Why that one and not the others:
 *  - It is the only date surface `updateExam` persists (`fieldMap.dates → important_dates`).
 *  - It is the only date surface the public frontend reads (`examService.dates`,
 *    `ImportantDatesTable`, `HomeSidebar`, and every content-type timeline table).
 *  - The Dates & Fees tab's registry date fields write to `form.typeFields.*`, which
 *    `buildUpdatePayload` does not include — those values were silently discarded on
 *    save. Rendering them as read-only chips removes a data-loss bug, not just a
 *    duplicate input.
 *
 * The type strings intentionally match ELMS `STANDARD_DATE_TYPES` so that any future
 * reconciliation between the two systems does not need a second mapping table.
 */

export const EXAM_STANDARD_DATE_TYPES = [
  'notification_date',
  'application_start',
  'application_end',
  'fee_payment_last_date',
  'exam_date',
  'admit_card_release',
  'answer_key_release',
  'result_date',
] as const

export type ExamStandardDateType = typeof EXAM_STANDARD_DATE_TYPES[number]

export const EXAM_STANDARD_DATE_LABELS: Record<ExamStandardDateType, string> = {
  notification_date:     'Notification Date',
  application_start:     'Application Start Date',
  application_end:       'Application End Date',
  fee_payment_last_date: 'Fee Payment Last Date',
  exam_date:             'Exam Date',
  admit_card_release:    'Admit Card Release Date',
  answer_key_release:    'Answer Key Release Date',
  result_date:           'Result Date',
}

/**
 * Registry field keys (from `config/moduleRegistry.ts`) that represent a standard
 * date and must therefore NOT be independently editable.
 *
 * Covers both duplicate surfaces:
 *  - entityProfile.dateFields  → the Dates & Fees tab
 *  - module fields             → Content Modules (application, admit-card, answer-key, result…)
 */
export const REGISTRY_KEY_TO_STANDARD_DATE: Record<string, ExamStandardDateType> = {
  // Dates & Fees tab (recruitment / entrance / board / university profiles)
  notificationDate:      'notification_date',
  lastDateApply:         'application_end',
  feeLastDate:           'fee_payment_last_date',
  examDate:              'exam_date',
  registrationOpen:      'application_start',
  registrationClose:     'application_end',
  examWindowStart:       'exam_date',
  resultExpected:        'result_date',
  admissionOpen:         'application_start',
  admissionClose:        'application_end',
  resultDate:            'result_date',
  theoryStartDate:       'exam_date',
  // Content Modules — application
  applicationStartDate:  'application_start',
  applicationEndDate:    'application_end',
  lastDateFeePayment:    'fee_payment_last_date',
  // Content Modules — admit card / answer key / result
  admitCardReleaseDate:  'admit_card_release',
  answerKeyReleaseDate:  'answer_key_release',
  resultDeclaredDate:    'result_date',
}

/** A single entry in `exams.important_dates`. `type` is additive and optional. */
export interface ExamDateEntry {
  label: string
  date: string
  isUrgent?: boolean
  /** Standard date type, or undefined/'custom' for free-form editorial rows. */
  type?: ExamStandardDateType | 'custom'
}

export function isStandardDateKey(key: string): boolean {
  return key in REGISTRY_KEY_TO_STANDARD_DATE
}

export function standardTypeForKey(key: string): ExamStandardDateType | null {
  return REGISTRY_KEY_TO_STANDARD_DATE[key] ?? null
}

/**
 * Resolve the canonical value for a standard date type from the `dates` array.
 *
 * Matching is by `type` first. For rows created before typing existed, falls back
 * to a case-insensitive label match against the standard label, so historical data
 * displays without a migration.
 */
export function findStandardDate(
  dates: ExamDateEntry[] | undefined,
  type: ExamStandardDateType
): ExamDateEntry | null {
  const rows = dates ?? []
  const typed = rows.find(d => d.type === type)
  if (typed) return typed

  const label = EXAM_STANDARD_DATE_LABELS[type].toLowerCase()
  const byLabel = rows.find(d => (d.label ?? '').trim().toLowerCase() === label)
  return byLabel ?? null
}

/** Format an ISO date (yyyy-mm-dd) as DD MMM YYYY, or "Not set" when empty. */
export function formatExamDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Types already present in the `dates` array. Used to stop a second row being
 * created for a type that already has one.
 */
export function usedStandardTypes(dates: ExamDateEntry[] | undefined): Set<string> {
  const set = new Set<string>()
  for (const d of dates ?? []) {
    if (d.type && d.type !== 'custom') set.add(d.type)
  }
  return set
}

// ── Forward-correctness helpers ───────────────────────────────────────────────
// Deliberate scope: these apply to NEW work only. Existing `important_dates` rows
// are left exactly as they are — untyped rows still display via the label fallback
// in findStandardDate(). No backfill, by decision.

/**
 * The eight standard rows, pre-labelled and empty, for a NEW exam.
 *
 * Seeding at creation is what makes future data typed by construction: the editor
 * never has to know that "type" matters, and every new exam ends up with the same
 * canonical date vocabulary.
 */
export function buildSeedDates(): ExamDateEntry[] {
  return EXAM_STANDARD_DATE_TYPES.map(type => ({
    type,
    label: EXAM_STANDARD_DATE_LABELS[type],
    date: '',
    isUrgent: false,
  }))
}

/** True when a row carries no usable date. */
function isEmptyDateRow(row: ExamDateEntry): boolean {
  return !row?.date || row.date.trim() === ''
}

/**
 * Prepare `dates` for persistence.
 *
 * 1. Drops rows with no date. Seeded-but-unfilled standard rows must never reach
 *    `exams.important_dates`, because the public frontend renders every row it finds
 *    (`ImportantDatesTable`, `HomeSidebar`, and the per-content-type timeline tables
 *    all map over the array) and would show blank timeline entries.
 * 2. Fills a missing label from the standard type, so a typed row can never publish
 *    with an empty event name — the frontend displays `d.label` directly.
 */
export function prepareDatesForSave(
  dates: ExamDateEntry[] | undefined
): Array<ExamDateEntry & { isUrgent: boolean }> {
  return (dates ?? [])
    .filter(row => !isEmptyDateRow(row))
    .map(row => {
      const isStandard = !!row.type && row.type !== 'custom'
      const label = row.label?.trim()
        ? row.label
        : isStandard
          ? EXAM_STANDARD_DATE_LABELS[row.type as ExamStandardDateType]
          : ''
      // isUrgent is normalised so the persisted shape always matches what the
      // frontend and the form schema expect.
      return { ...row, label, isUrgent: row.isUrgent ?? false }
    })
    .filter(row => row.label !== '')
}

/** Default label for a type, used when the editor switches a row's type. */
export function defaultLabelForType(type: string): string {
  if (!type || type === 'custom') return ''
  return EXAM_STANDARD_DATE_LABELS[type as ExamStandardDateType] ?? ''
}

/** True when a label is still one of the untouched standard labels (safe to replace). */
export function isDefaultStandardLabel(label: string | undefined): boolean {
  if (!label) return true
  const l = label.trim().toLowerCase()
  return Object.values(EXAM_STANDARD_DATE_LABELS).some(v => v.toLowerCase() === l)
}
