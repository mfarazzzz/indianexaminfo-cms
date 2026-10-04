/**
 * FX3 A5 — pickDraftWhenNoCurrent: which edition to offer activating when the
 * exam has no current cycle but other editions/drafts exist.
 */
import { describe, it, expect } from 'vitest'
import { pickDraftWhenNoCurrent } from './EntranceExamEditorPage'

const eds = [
  { id: 'ed-2027', isCurrent: false, editionLabel: '2027' },
  { id: 'ed-2025', isCurrent: false, editionLabel: '2025' },
]

describe('pickDraftWhenNoCurrent (A5)', () => {
  it('returns the most recent non-current edition when there is no current and no pending draft', () => {
    expect(pickDraftWhenNoCurrent(eds, false, false)).toEqual({ id: 'ed-2027', editionLabel: '2027' })
  })

  it('returns null when a current edition exists (no banner needed)', () => {
    expect(pickDraftWhenNoCurrent([{ id: 'c', isCurrent: true, editionLabel: '2026' }, ...eds], true, false)).toBeNull()
  })

  it('returns null when a pending in-memory draft exists (the draft banner covers it)', () => {
    expect(pickDraftWhenNoCurrent(eds, false, true)).toBeNull()
  })

  it('returns null when there are no editions at all (the plain "no cycle" state)', () => {
    expect(pickDraftWhenNoCurrent([], false, false)).toBeNull()
  })

  it('falls back to the first edition if every row is somehow marked current', () => {
    const allCurrent = [{ id: 'x', isCurrent: true, editionLabel: 'X' }]
    // hasCurrent=false passed (e.g. the exam's current_edition_id is stale/null);
    // no non-current row -> returns the first, so the banner still offers an action.
    expect(pickDraftWhenNoCurrent(allCurrent, false, false)).toEqual({ id: 'x', editionLabel: 'X' })
  })
})
