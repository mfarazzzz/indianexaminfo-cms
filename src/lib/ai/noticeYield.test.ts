/**
 * v10 — the ai-fill low-yield transport gate.
 *
 * Design: docs/design/ai-fill-low-yield-fallback.md. The gate answers one
 * question: did the provider return a timeline that is materially thinner than
 * the notice it was given? It counts rows; it never decides whether a date is
 * right, which is what keeps a genuinely short notice safe.
 *
 * The metric helpers live in the Edge Function's templates.ts (pure TypeScript,
 * no Deno APIs), so this test imports them directly — tsconfig allows the .ts
 * specifier (allowImportingTsExtensions) and the file type-checks standalone.
 * The control flow itself lives in index.ts, which is a Deno bundle and cannot
 * be imported here; it is guarded structurally at the bottom of this file, the
 * way aiFillLegacyBranch.test.ts guards the legacy branch.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  countDistinctDates, isLowYield, lowYieldDetail, lowYieldLog, validateAnswer,
  type AllowedOptionsServer,
} from '../../../supabase/functions/ai-fill/templates.ts'
import { parseNoticeAnswer } from './noticePipeline'

const FIX = (name: string) => resolve(__dirname, `./__fixtures__/up-deled-2026-phase3/${name}`)
const RRB_FIX = (name: string) => resolve(__dirname, `./__fixtures__/rrb-ntpc-2026/${name}`)
const lf = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const upDeledSource = lf(FIX('pasted.txt'))
const rrbSource = lf(RRB_FIX('pasted.txt'))

const options: AllowedOptionsServer = {
  categories: [
    { slug: 'teaching-and-education', name: 'Teaching and Education' },
    { slug: 'engineering', name: 'Engineering' },
  ],
  regions: [{ slug: 'up', label: 'Uttar Pradesh' }, { slug: 'all-india', label: 'All India' }],
  entityTypes: ['exam', 'university-admission'],
  selectionModels: ['written-exam', 'merit-based', 'interview-based', 'internal-admission'],
}

/** The rows N the SERVER would hand back for an answer (validateAnswer drops a
 *  row with no label or no dateText — that drop is part of the count). */
function serverRows(answer: Record<string, unknown>): number {
  const validated = validateAnswer(answer, options)
  return ((validated.content as { dates?: unknown[] }).dates ?? []).length
}

const upDeledGolden = parseNoticeAnswer(JSON.parse(readFileSync(FIX('model.responses.json'), 'utf8')).raw)
const upDeledLive = JSON.parse(readFileSync(FIX('model.responses.live.json'), 'utf8')) as Record<string, unknown>
const rrbGolden = JSON.parse(readFileSync(RRB_FIX('model.responses.json'), 'utf8')).answer as Record<string, unknown>

describe('v10 countDistinctDates: what counts as a dated moment', () => {
  it('numeric dd.mm.yyyy, de-duplicated across the whole text', () => {
    expect(countDistinctDates('Last date 06.11.2026. Again 06.11.2026 and 08.10.2026.')).toBe(2)
  })

  it('a window 05.10.2026 से 07.10.2026 is TWO distinct days', () => {
    expect(countDistinctDates('Choice filling 05.10.2026 से 07.10.2026.')).toBe(2)
  })

  it('dd/mm/yyyy and a 2-digit year normalise to the same day', () => {
    expect(countDistinctDates('12/11/2026 and 12.11.26')).toBe(1)
  })

  it('yyyy-mm-dd (ISO) counts', () => {
    expect(countDistinctDates('Published 2026-10-05, closes 2026-11-06')).toBe(2)
  })

  it('English month names and abbreviations count, and the same day written two ways counts once', () => {
    expect(countDistinctDates('Allotment 08 October 2026; lock 15 Oct 2026; repeat 8 Oct 2026')).toBe(2)
  })

  it('Hindi month names in both -म्बर and -ंबर spellings count', () => {
    expect(countDistinctDates('अंक 05 अक्टूबर 2026, अंतिम तिथि 06 नवंबर 2026, 07 सितम्बर 2026')).toBe(3)
  })

  it('Devanagari digits are folded, so a pure-Hindi notice is not invisible to the gate', () => {
    expect(countDistinctDates('आवेदन की अंतिम तिथि ०६.११.२०२६ है।')).toBe(1)
  })

  it('a bare session year, a roll number and an amount are NOT dates', () => {
    expect(countDistinctDates('Session 2026-27, Advt No : CEN 06/2026, fee ₹5,000, rank 1,52,202')).toBe(0)
  })

  it('an impossible month is rejected rather than counted', () => {
    expect(countDistinctDates('Bogus 13.45.2026')).toBe(0)
  })

  it('undated text yields 0 (the gate has no yardstick and stays out of the way)', () => {
    expect(countDistinctDates('Candidates are advised to follow the official website for updates.')).toBe(0)
  })

  it('measured M for the two real notices: UP D.El.Ed 9, RRB NTPC 2', () => {
    // Re-measured here so the design doc cannot drift from the code silently.
    expect(countDistinctDates(upDeledSource)).toBe(9)
    expect(countDistinctDates(rrbSource)).toBe(2)
  })
})

describe('v10 isLowYield: the truth table from the design', () => {
  const cases: [number, number, boolean][] = [
    // M, N, expected low-yield
    [0, 0, false],   // no yardstick at all — never judge
    [1, 0, false], [1, 1, false],
    [2, 0, false], [2, 1, false], [2, 3, false], // M<=2: inert at any N
    [3, 0, true],    // T1: three dated moments, empty timeline
    [3, 1, false], [3, 2, false], [3, 3, false],
    [4, 0, true], [4, 1, false], [4, 4, false],
    [5, 0, true], [5, 1, false], [5, 5, false],
    [6, 0, true], [6, 2, true], [6, 3, false],   // T2 starts: floor(6/3) = 2
    [9, 0, true], [9, 3, true], [9, 4, false], [9, 5, false], [9, 7, false],
    [12, 4, true], [12, 5, false],
  ]
  for (const [m, n, expected] of cases) {
    it(`M=${m} N=${n} -> ${expected ? 'LOW_YIELD (refuse, try the next provider)' : 'accept'}`, () => {
      expect(isLowYield(m, n)).toBe(expected)
    })
  }
})

describe('v10: the sparse D.El.Ed shapes trigger', () => {
  const fullRows = (upDeledGolden.dates as Record<string, unknown>[])
  it('the recorded golden answer (5 rows against M=9) is NOT low-yield', () => {
    expect(serverRows(upDeledGolden)).toBe(5)
    expect(isLowYield(countDistinctDates(upDeledSource), serverRows(upDeledGolden))).toBe(false)
  })

  it('the recorded live answer (7 rows, split windows) is NOT low-yield', () => {
    expect(serverRows(upDeledLive)).toBe(7)
    expect(isLowYield(countDistinctDates(upDeledSource), serverRows(upDeledLive))).toBe(false)
  })

  it('the acceptance table itself (4 rows) is NOT low-yield', () => {
    const four = { ...upDeledGolden, dates: fullRows.slice(0, 4) }
    expect(serverRows(four)).toBe(4)
    expect(isLowYield(countDistinctDates(upDeledSource), serverRows(four))).toBe(false)
  })

  it('1, 2 and 3 rows against this notice ARE low-yield (the 14 Oct class)', () => {
    const m = countDistinctDates(upDeledSource)
    for (const keep of [0, 1, 2, 3]) {
      const thin = { ...upDeledGolden, dates: fullRows.slice(0, keep) }
      expect(serverRows(thin)).toBe(keep)
      expect(isLowYield(m, serverRows(thin)), `${keep} rows must trigger`).toBe(keep <= 3)
    }
  })

  it('the shape the 15 Oct live run actually produced (no date rows at all) triggers', () => {
    const n = serverRows({ ...upDeledGolden, dates: [] })
    expect(n).toBe(0)
    expect(isLowYield(countDistinctDates(upDeledSource), n)).toBe(true)
  })
})

describe('v10: what the gate does NOT catch (deliberate scope)', () => {
  const m = countDistinctDates(upDeledSource)

  it('a SPLIT WINDOW adds rows, so it never trips a count-based gate', () => {
    // One counselling window emitted as two rows: the pairing net re-merges it
    // client-side (S2.9); punishing it here would be a false rejection.
    const base = upDeledLive
    expect(serverRows(base)).toBe(7)
    expect(isLowYield(m, serverRows(base))).toBe(false)
  })

  it('a WRONG KIND keeps the row count whole, so it is not a yield failure', () => {
    const misKinded = {
      ...upDeledGolden,
      dates: (upDeledGolden.dates as Record<string, unknown>[]).map((d, i) =>
        i === 0 ? { ...d, kind: 'registration_start', type: 'application_start' } : d),
    }
    expect(serverRows(misKinded)).toBe(5)
    expect(isLowYield(m, serverRows(misKinded))).toBe(false)
    // It is still reported — by validateAnswer's own vocabulary issue, not here.
    const validated = validateAnswer(misKinded, options)
    expect(validated.issues.some((i) => i.reason === 'low_yield')).toBe(false)
  })

  it('dropped rows are exactly the class the gate exists for', () => {
    const dropped = { ...upDeledGolden, dates: (upDeledGolden.dates as Record<string, unknown>[]).slice(0, 2) }
    expect(isLowYield(m, serverRows(dropped))).toBe(true)
  })
})

describe('v10: a notice with genuinely few dates must NOT trigger', () => {
  it('the RRB NTPC golden (M=2, three rows for a two-day window) is accepted', () => {
    const m = countDistinctDates(rrbSource)
    expect(m).toBe(2)
    expect(serverRows(rrbGolden)).toBe(3)
    expect(isLowYield(m, serverRows(rrbGolden))).toBe(false)
  })

  it('the synthetic two-line recruitment window (M=3, two rows) is accepted', () => {
    const src = 'Online application form submission: 01.11.2026 to 30.11.2026 (up to 11:59 PM).\nFee payment last date 02.12.2026.'
    const rows = [
      { label: 'Application begins', dateText: '01.11.2026', type: 'application_start', kind: 'registration_start', confidence: 0.9, sourceQuote: 'Online application form submission' },
      { label: 'Last date', dateText: '30.11.2026', type: 'application_end', kind: 'registration_end', confidence: 0.9, sourceQuote: 'to 30.11.2026' },
    ]
    const m = countDistinctDates(src)
    expect(m).toBe(3)
    expect(isLowYield(m, serverRows({ fields: {}, dates: rows }))).toBe(false)
  })

  it('a one-deadline letter answered with that one row is accepted', () => {
    const src = 'The revised last date for fee payment is 12.11.2026. No other date is announced.'
    const rows = [{ label: 'Fee last date', dateText: '12.11.2026', type: 'other', kind: 'fee_last_date', confidence: 0.9, sourceQuote: 'revised last date for fee payment is 12.11.2026' }]
    expect(countDistinctDates(src)).toBe(1)
    expect(isLowYield(countDistinctDates(src), serverRows({ fields: {}, dates: rows }))).toBe(false)
  })

  it('a one-deadline letter answered with NO rows is still accepted (M<3 — not enough evidence to refuse)', () => {
    const src = 'The revised last date for fee payment is 12.11.2026.'
    expect(isLowYield(countDistinctDates(src), 0)).toBe(false)
  })
})

describe('v10: the audit marker and the editor issue text', () => {
  it('low_yield: got N of ~M is exactly the logged string', () => {
    expect(lowYieldLog(0, 9)).toBe('low_yield: got 0 of ~9')
    expect(lowYieldLog(2, 12)).toBe('low_yield: got 2 of ~12')
  })

  it('the issue says what is missing and tells the editor what to do', () => {
    const detail = lowYieldDetail(3, 9)
    expect(detail).toContain('only 3 of ~9')
    expect(detail).toContain('some events were dropped')
    expect(detail).toContain('check the timeline before saving')
  })
})

describe('v10: the deployed handler actually consults the gate (structural guard)', () => {
  const src = lf(resolve(__dirname, '../../../supabase/functions/ai-fill/index.ts'))

  it('the yardstick is computed from the source text before any provider is called', () => {
    const mIdx = src.indexOf('countDistinctDates(sourceText)')
    const firstCall = src.indexOf('callOne(target, prompt, true, tcontroller.signal, TEMPLATE_MAX_OUTPUT_TOKENS)')
    expect(mIdx).toBeGreaterThan(-1)
    expect(mIdx).toBeLessThan(firstCall)
  })

  it('the verdict is taken from validateAnswer output, and a thin answer falls through instead of returning', () => {
    expect(src).toMatch(/const rowsReturned = \(\(validated\.content as \{ dates\?: unknown\[\] \}\)\?\.dates \?\? \[\]\)\.length;/)
    expect(src).toContain('if (isLowYield(distinctDates, rowsReturned)) {')
    const gate = src.indexOf('if (isLowYield(distinctDates, rowsReturned)) {')
    const successReturn = src.indexOf('return json({ content: validated.content, issues: validated.issues, provider: target.provider')
    expect(gate).toBeLessThan(successReturn)
    expect(src.slice(gate, successReturn)).toContain('if (pi < providers.length - 1) continue;')
    expect(src.slice(gate, successReturn)).toContain('break;')
  })

  it('every refused attempt is logged as low_yield with status error', () => {
    expect(src).toMatch(/logCall\(admin, target\.providerId, userId, hash, "error", lowYieldLog\(rowsReturned, distinctDates\)/)
  })

  it('the thin-but-best answer is returned as 200 with a low_yield issue, BEFORE the 502 path', () => {
    const bestBlock = src.indexOf('if (bestLow) {')
    const notJson502 = src.indexOf('"template answer was not JSON"')
    const chain502 = src.indexOf('return json({ error: tLast === "timed out"')
    expect(bestBlock).toBeGreaterThan(-1)
    expect(bestBlock).toBeLessThan(chain502)
    expect(src.slice(bestBlock, chain502)).toContain('}, 200, cors.headers)')
    expect(src.slice(bestBlock, chain502)).toContain('reason: "low_yield"')
    expect(src.slice(bestBlock, chain502)).toContain('lowYieldLog(bestLow.n, distinctDates)')
    // No 502 exists between the gate and the bestLow block: low yield alone
    // cannot produce one. (The only 502s are the not-JSON case and the
    // all-providers-failed case.)
    const gateIdx = src.indexOf('if (isLowYield(distinctDates, rowsReturned)) {')
    expect(src.slice(gateIdx, bestBlock)).not.toContain('}, 502, cors.headers)')
    expect(notJson502).toBeGreaterThan(-1)
  })

  it('the refused attempt does NOT disarm the overall timeout guard, and the accepted answer still updates provider health', () => {
    const gate = src.indexOf('if (isLowYield(distinctDates, rowsReturned)) {')
    const successClear = src.indexOf('clearTimeout(ttimer);', gate)
    expect(successClear).toBeGreaterThan(gate) // the guard is cleared on the way OUT, not before the retry
    expect(src.slice(gate, successClear)).toContain('continue;')
    expect(src.slice(successClear, successClear + 700)).toContain('last_used_at')
  })

  it('the legacy raw-prompt path is not gated (S2.8 removes it; behaviour must not move)', () => {
    const legacy = src.indexOf('── Legacy raw-prompt path')
    expect(legacy).toBeGreaterThan(-1)
    expect(src.slice(legacy)).not.toContain('isLowYield')
  })
})
