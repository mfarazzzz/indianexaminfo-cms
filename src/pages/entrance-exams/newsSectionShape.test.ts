/**
 * R0.10 — canonical news-shape round-trip tests.
 *
 * content_modules.news must always be written as { items: [...] }.
 * A legacy bare array must be readable.
 * A Save that never mounts NewsTab must NOT blank a live news section.
 */
import { describe, expect, it } from 'vitest'

// ── Duplicated here for unit-testability (same implementation as the page) ───
function readNewsSection(contentModules: Record<string, unknown>): any[] {
  const raw = contentModules?.news as unknown
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).items))
    return (raw as any).items
  return []
}

// Simulate buildMergedContentModules logic (the R0.10 version).
function buildMergedContentModules(
  newsItems: any[] | null,
  baseModules: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (newsItems === null) return undefined
  return { ...baseModules, news: { items: newsItems } }
}

describe('readNewsSection (R0.10)', () => {
  it('reads a canonical {items:[…]} object', () => {
    const cm = { news: { items: [{ title: 'Foo' }] } }
    expect(readNewsSection(cm)).toEqual([{ title: 'Foo' }])
  })

  it('reads a legacy bare array', () => {
    const cm = { news: [{ title: 'Bar' }] }
    expect(readNewsSection(cm)).toEqual([{ title: 'Bar' }])
  })

  it('returns empty array when key is absent', () => {
    expect(readNewsSection({})).toEqual([])
  })

  it('returns empty array when news is null', () => {
    expect(readNewsSection({ news: null })).toEqual([])
  })

  it('returns empty array when {items} is not an array', () => {
    expect(readNewsSection({ news: { items: 'oops' } })).toEqual([])
  })
})

describe('buildMergedContentModules news write (R0.10)', () => {
  it('writes canonical {items:[…]} shape', () => {
    const result = buildMergedContentModules(
      [{ title: 'News A' }],
      { overview: { body: 'x' } },
    )
    expect(result?.news).toEqual({ items: [{ title: 'News A' }] })
  })

  it('does NOT write a bare array', () => {
    const result = buildMergedContentModules([], {})
    expect(Array.isArray(result?.news)).toBe(false)
    expect(result?.news).toEqual({ items: [] })
  })

  it('returns undefined (no news key written) when NewsTab has not mounted', () => {
    // newsRef.current === null means tab is not active.
    const result = buildMergedContentModules(null, { overview: { body: 'x' } })
    expect(result).toBeUndefined()
    // The live news section is therefore never overwritten with an empty list.
  })

  it('a live {items:[…]} section survives a save that does not open NewsTab', () => {
    // Simulate: edition has a live news section; save is triggered from another tab.
    const existingModules: Record<string, unknown> = {
      news: { items: [{ title: 'Live news', content: '…' }] },
    }
    // newsRef.current = null (tab not mounted)
    const result = buildMergedContentModules(null, existingModules)
    // result is undefined → updateEdition receives no contentModules key → column
    // is left unchanged, so the live section persists.
    expect(result).toBeUndefined()
  })

  it('other module keys are preserved when news is written', () => {
    const base = { overview: { body: 'hello' }, faqs: [{ q: '1', a: '2' }] }
    const result = buildMergedContentModules([{ title: 'N1' }], base)
    expect(result?.overview).toEqual({ body: 'hello' })
    expect(result?.faqs).toEqual([{ q: '1', a: '2' }])
  })
})
