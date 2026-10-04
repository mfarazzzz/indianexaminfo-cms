/**
 * R1.8 — URL tracking parameter stripping tests.
 * R1.9 — Duplicate-slug friendly error structure tests.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { normalizeUrl, stripTrackingParams } from '@/lib/utils'

// ── R1.8: stripTrackingParams ─────────────────────────────────────────────────

describe('stripTrackingParams (R1.8)', () => {
  it('strips utm_source, utm_medium, utm_campaign', () => {
    const out = stripTrackingParams('https://updeled.gov.in/?utm_source=chatgpt.com&utm_medium=cpc&utm_campaign=spring')
    expect(out).not.toContain('utm_source')
    expect(out).not.toContain('utm_medium')
    expect(out).not.toContain('utm_campaign')
    expect(out).toContain('updeled.gov.in')
  })

  it('strips gclid, fbclid, mc_cid, mc_eid, msclkid, dclid', () => {
    const url = 'https://example.com/page?gclid=abc&fbclid=def&mc_cid=1&mc_eid=2&msclkid=3&dclid=4'
    const out = stripTrackingParams(url)
    for (const param of ['gclid', 'fbclid', 'mc_cid', 'mc_eid', 'msclkid', 'dclid']) {
      expect(out).not.toContain(param)
    }
  })

  it('strips ref when value matches chatgpt.com', () => {
    const out = stripTrackingParams('https://example.com/?ref=chatgpt.com')
    expect(out).not.toContain('ref')
  })

  it('strips source when value matches perplexity', () => {
    const out = stripTrackingParams('https://example.com/?source=perplexity')
    expect(out).not.toContain('source')
  })

  it('KEEPS ref when value is a legitimate site', () => {
    const out = stripTrackingParams('https://example.com/?ref=nationalportal.in')
    expect(out).toContain('ref=nationalportal.in')
  })

  it('KEEPS legitimate query params (id, page, lang)', () => {
    const url = 'https://example.com/exam?id=42&page=2&lang=en'
    const out = stripTrackingParams(url)
    expect(out).toContain('id=42')
    expect(out).toContain('page=2')
    expect(out).toContain('lang=en')
  })

  it('returns clean URL unchanged when no tracking params present', () => {
    const url = 'https://ibps.in/apply/'
    expect(stripTrackingParams(url)).toBe(url)
  })

  it('handles URL with no query string', () => {
    expect(stripTrackingParams('https://nta.ac.in')).toContain('nta.ac.in')
  })
})

describe('normalizeUrl integrates tracking param stripping (R1.8)', () => {
  it('strips utm_source from a URL with protocol', () => {
    const out = normalizeUrl('https://updeled.gov.in?utm_source=chatgpt.com')
    expect(out).not.toContain('utm_source')
    expect(out).toContain('updeled.gov.in')
  })

  it('strips tracking params from a URL without protocol', () => {
    const out = normalizeUrl('updeled.gov.in?fbclid=abc123')
    expect(out).not.toContain('fbclid')
    expect(out).toContain('updeled.gov.in')
  })

  it('still rejects multi-URL values', () => {
    expect(normalizeUrl('https://a.com, https://b.com')).toBe('')
  })

  it('empty input returns empty', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(null)).toBe('')
    expect(normalizeUrl(undefined)).toBe('')
  })
})

// ── R1.9: Duplicate-slug error structure ─────────────────────────────────────
// Tests for the structured error thrown by createEntranceExam are in
// src/services/entranceExamService.duplicateSlug.test.ts (they require
// vi.mock at the top-level module scope, not inside a describe block).
