/**
 * S2.2 — event vocabulary for admissions and counselling.
 *
 * Pins the owner-approved two-vocabulary contract:
 *  • `type` is ONLY ever a value exam_derived_status already knows (VIEW-safe).
 *  • `kind` carries the fine-grained event.
 *  • Unknown labels are KEPT as custom rows (never dropped, source label intact).
 *  • cut-off is typed "cutoff", NOT "result" (stops driving result_confirmed).
 *  • extension is a supersedes-row (kind "extension"), not a new type.
 */
import { describe, expect, it } from 'vitest'
import { normalizeLabel, typeForKind, type NormalizedDate } from './normalizeLabel'

/** The exact type vocabulary exam_derived_status (migration 20260902122910)
 *  reads. If normalizeLabel ever emits something outside this set, published
 *  exams' derived status silently breaks — this test is the fence. */
const VIEW_SAFE_TYPES = new Set([
  'application_start', 'application_end', 'notification', 'admit_card',
  'answer_key', 'result', 'merit_list', 'counselling', 'exam_written',
  'exam_practical', 'exam_physical', 'exam_city_intimation', 'interview',
  'walkin', 'cutoff', 'other',
])

describe('normalizeLabel — type stays VIEW vocabulary (S2.2)', () => {
  it('every label maps to a type exam_derived_status already knows', () => {
    const probes = [
      'Registration Opens', 'Last date to apply', 'Fee payment last date',
      'Choice Filling Phase-3', 'Seat Allotment', 'Document Verification',
      'Admission window', 'Institute Locking / FREEZE', 'State Rank Release',
      'Merit List', 'Session Start', 'Cutoff Release', 'Exam City Intimation',
      'Admit Card', 'Answer Key', 'Result', 'Exam Date', 'Interview',
      'Walk-in drive', 'Totally Unknown Event xyz',
    ]
    for (const label of probes) {
      const n = normalizeLabel(label)
      expect(VIEW_SAFE_TYPES.has(n.type), `"${label}" → type "${n.type}"`).toBe(true)
    }
  })
})

describe('normalizeLabel — owner-approved kind/type mapping (S2.2)', () => {
  const cases: [string, string, string][] = [
    // [label, expected type, expected kind]
    ['Registration Starts',                    'application_start', 'registration_start'],
    ['Application Opened',                     'application_start', 'registration_start'],
    ['Registration Closes',                    'application_end',   'registration_end'],
    ['Last Date for Submission of Application','application_end',   'registration_end'],
    ['Choice Filling (Phase-3)',               'counselling',       'choice_filling'],
    ['Option Registration',                    'counselling',       'choice_filling'],
    ['Seat Allotment — Phase 3',               'counselling',       'allotment'],
    ['Document Verification',                  'counselling',       'document_verification'],
    ['Reporting / Admission Window',           'counselling',       'document_verification'],
    ['Admission',                              'counselling',       'admission'],
    ['Institution Locking / FREEZE',           'counselling',       'institute_lock'],
    ['State Rank Release',                     'merit_list',        'rank_release'],
    ['Merit List',                             'merit_list',        'merit_list'],
    ['Fee Payment Last Date',                  'other',             'fee_last_date'],
    ['Printed Certificate Last Date',          'other',             'print_last_date'],
    ['Application Correction Window',          'other',             'correction_window'],
    ['Academic Session Starts',                'other',             'session_start'],
    ['Cutoff Marks Release',                   'cutoff',            'cutoff'],
    ['Notification Release',                   'notification',      'notification'],
    ['Admit Card Download',                    'admit_card',        'admit_card'],
    ['Answer Key Challenge',                   'answer_key',        'answer_key'],
    ['Result Declaration',                     'result',            'result'],
    ['Exam Date',                              'exam_written',      'exam_written'],
  ]
  it.each(cases)('%s → type %s, kind %s', (label, type, kind) => {
    const n = normalizeLabel(label)
    expect(n.type).toBe(type)
    expect(n.kind).toBe(kind)
  })

  it('cut-off is no longer typed "result" (the S2.2 fix)', () => {
    expect(normalizeLabel('Category Cutoff 2026').type).toBe('cutoff')
  })
})

describe('normalizeLabel — extension is a supersedes row, not a type', () => {
  it('an extension of registration keeps kind "extension" and the application_end type', () => {
    const n = normalizeLabel('Registration Extended to 03.08.2026')
    expect(n.kind).toBe('extension')
    expect(n.type).toBe('application_end')
    // The source label survives — it says WHAT was extended.
    expect(n.label).toBe('Registration Extended to 03.08.2026')
  })

  it('an unattributed extension rides type "other" with kind "extension"', () => {
    const n = normalizeLabel('Date Extension Notice')
    expect(n.kind).toBe('extension')
    expect(n.type).toBe('other')
  })
})

describe('normalizeLabel — S2.2a status-safety gate (merit-based records)', () => {
  it('merit-based: rank_release and merit_list store as type "other" (kind kept)', () => {
    const rank = normalizeLabel('State Rank Release', 'merit-based')
    expect(rank.type).toBe('other')
    expect(rank.kind).toBe('rank_release')
    const merit = normalizeLabel('Merit List', 'merit-based')
    expect(merit.type).toBe('other')
    expect(merit.kind).toBe('merit_list')
  })

  it('internal-admission is gated the same way', () => {
    expect(normalizeLabel('State Rank Release', 'internal-admission').type).toBe('other')
  })

  it('written-exam / interview-based keep the result-family type', () => {
    expect(normalizeLabel('State Rank Release', 'written-exam').type).toBe('merit_list')
    expect(normalizeLabel('Merit List', 'interview-based').type).toBe('merit_list')
  })

  it('no selection model given → legacy behaviour unchanged (importers)', () => {
    expect(normalizeLabel('State Rank Release').type).toBe('merit_list')
    expect(normalizeLabel('Merit List', null).type).toBe('merit_list')
  })

  it('the gate never touches other kinds', () => {
    expect(normalizeLabel('Seat Allotment', 'merit-based').type).toBe('counselling')
    expect(normalizeLabel('Registration Closes', 'merit-based').type).toBe('application_end')
    expect(normalizeLabel('Result Declaration', 'merit-based').type).toBe('result')
  })

  it('typeForKind mirrors the gate (the pipeline\'s single source)', () => {
    expect(typeForKind('rank_release', 'merit-based')).toBe('other')
    expect(typeForKind('merit_list', 'merit-based')).toBe('other')
    expect(typeForKind('rank_release', 'written-exam')).toBe('merit_list')
    expect(typeForKind('choice_filling', 'merit-based')).toBe('counselling')
    expect(typeForKind('allotment')).toBe('counselling')
  })
})

describe('normalizeLabel — unknown labels are KEPT (the Phase-3 drop bug)', () => {
  it('never returns null; an unknown label becomes a custom row', () => {
    const n: NormalizedDate = normalizeLabel('Mop-up Round Slot Availability Check')
    expect(n).not.toBeNull()
    expect(n.type).toBe('other')
    expect(n.kind).toBe('other')
    expect(n.custom).toBe(true)
    expect(n.label).toBe('Mop-up Round Slot Availability Check') // source verbatim
  })

  it('"Score Validity" is no longer dropped — it survives as a custom row', () => {
    const n = normalizeLabel('Score Validity')
    expect(n.custom).toBe(true)
    expect(n.type).toBe('other')
  })

  it('tentative wording still marks the row expected', () => {
    expect(normalizeLabel('Result Declaration (Tentative)').state).toBe('expected')
    expect(normalizeLabel('Result Declaration').state).toBe('confirmed')
  })

  it('an empty label is still a valid custom row (never throws, never null)', () => {
    const n = normalizeLabel('   ')
    expect(n.custom).toBe(true)
    expect(n.type).toBe('other')
    expect(n.kind).toBe('other')
  })
})
