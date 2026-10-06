/**
 * S2.3 parity guard — the ai-fill Edge Function duplicates four platform
 * vocabularies (it is a standalone Deno bundle and cannot import from src/).
 * Drift between the two copies would make the server validate against a stale
 * list while the browser enforces a different one — the exact split-brain the
 * whole S-track exists to prevent. This test reads the function's templates.ts
 * AS TEXT and compares its constants to the TS sources' live values.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_ENTITY_TYPES, entityTypeForPillar, ENTRANCE_EXAM_ENTITY_CHOICES } from '@/config/moduleRegistry'
import { ALL_SELECTION_MODELS } from '@/types/selection'
import { normalizeLabel } from '@/lib/dates/normalizeLabel'

const templatesSrc = readFileSync(
  resolve(__dirname, '../../../supabase/functions/ai-fill/templates.ts'),
  'utf8',
)

/** Pull a string-array literal out of the Deno source: const X = ["a","b"]; */
function arrayConst(name: string): string[] {
  const m = templatesSrc.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))
  expect(m, `templates.ts must declare const ${name} = [...]`).toBeTruthy()
  return (m![1].match(/"([^"]+)"/g) ?? []).map((s) => s.replace(/"/g, ''))
}

describe('ai-fill templates.ts mirrors the TS vocabularies (S2.3)', () => {
  it('entity types match moduleRegistry ALL_ENTITY_TYPES', () => {
    expect(arrayConst('ENTITY_TYPES').sort()).toEqual([...ALL_ENTITY_TYPES].sort())
  })

  it('selection models match types/selection ALL_SELECTION_MODELS', () => {
    expect(arrayConst('SELECTION_MODELS').sort()).toEqual([...ALL_SELECTION_MODELS].sort())
  })

  it('the pillar→type map matches entityTypeForPillar for every pillar', () => {
    const pillars = [
      'government-exam', 'govt-vacancy', 'sarkari-naukri',
      'board-exam', 'board-university', 'university-exam',
      'university-admission', 'entrance-exam',
    ]
    for (const p of pillars) {
      const tsVal = entityTypeForPillar(p)
      const m = templatesSrc.match(new RegExp(`"${p}": (null|"${tsVal ?? 'x'}"|"[a-z-]+")`))
      expect(m, `templates.ts PILLAR_ENTITY_TYPE is missing "${p}"`).toBeTruthy()
      expect(m![1]).toBe(tsVal === null ? 'null' : `"${tsVal}"`)
    }
  })

  it('entrance-exam choices match', () => {
    expect(arrayConst('ENTRANCE_EXAM_CHOICES').sort()).toEqual([...ENTRANCE_EXAM_ENTITY_CHOICES].sort())
  })

  it('the template date-type list is exactly the VIEW vocabulary normalizeLabel may emit', () => {
    const dateTypes = arrayConst('DATE_TYPES')
    // normalizeLabel must never emit a type outside this list.
    const probes = [
      'Registration Opens', 'Registration Closes', 'Fee Last Date', 'Choice Filling',
      'Seat Allotment', 'Document Verification', 'Admission', 'Institution Lock',
      'State Rank Release', 'Merit List', 'Cutoff', 'Notification', 'Admit Card',
      'Answer Key', 'Result', 'Exam Date', 'Practical Exam', 'Physical Test',
      'Interview', 'Walk In', 'Exam City Intimation', 'Session Start',
      'Registration Extended', 'Something Unknown Entirely',
    ]
    for (const label of probes) {
      const t = normalizeLabel(label).type
      expect(dateTypes, `type "${t}" for "${label}" is not in the server-validated list`).toContain(t)
    }
  })

  it('the template kind list covers every kind normalizeLabel can emit', () => {
    const kinds = arrayConst('DATE_KINDS')
    const probes = [
      'Registration Opens', 'Registration Closes', 'Fee Payment Last Date',
      'Printed Certificate Last Date', 'Application Correction Window',
      'Notification Release', 'Registration Extended to 03.08.2026',
      'State Rank Release', 'Merit List', 'Choice Filling', 'Seat Allotment',
      'Document Verification', 'Admission', 'Institution Lock', 'Session Start',
      'Cutoff Release', 'Admit Card', 'Answer Key', 'Result', 'Exam Date',
      'Practical Exam', 'Physical Test', 'Interview', 'Walk In', 'Exam City Intimation',
      'Totally Unknown Thing',
    ]
    for (const label of probes) {
      const k = normalizeLabel(label).kind
      expect(kinds, `kind "${k}" for "${label}" is not in the server-validated list`).toContain(k)
    }
  })

  it('the confidence floor is the same number on both sides', () => {
    const m = templatesSrc.match(/const OPTION_CONFIDENCE_FLOOR = ([\d.]+)/)
    expect(m).toBeTruthy()
    return import('@/lib/ai/extractionContract').then(({ OPTION_CONFIDENCE_FLOOR }) => {
      expect(parseFloat(m![1])).toBe(OPTION_CONFIDENCE_FLOOR)
    })
  })
})
