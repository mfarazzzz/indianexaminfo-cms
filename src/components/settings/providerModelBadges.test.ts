/**
 * S2.13(b) — the pure logic behind the panel's model-management badges and the
 * combobox suggestion source. Kept out of the component so each rule is testable
 * without rendering.
 */
import { describe, it, expect } from 'vitest'
import { modelLooksRetired, neverSucceeded, modelSuggestions } from './providerModelBadges'

describe('modelLooksRetired', () => {
  it('is false when no live list was fetched (never cry wolf)', () => {
    expect(modelLooksRetired('gemini-2.5-flash', null)).toBe(false)
    expect(modelLooksRetired('gemini-2.5-flash', [])).toBe(false)
  })
  it('is true only when a live list exists and the model is absent from it', () => {
    expect(modelLooksRetired('gemini-2.5-flash', ['gemini-3.8-flash', 'gemini-2.5-pro'])).toBe(true)
    expect(modelLooksRetired('gemini-3.8-flash', ['gemini-3.8-flash'])).toBe(false)
  })
})

describe('neverSucceeded', () => {
  it('is true for a row with no recorded success and a 404 / model_not_found error', () => {
    expect(neverSucceeded({ lastUsedAt: null, lastError: 'groq returned 404 The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.' })).toBe(true)
    expect(neverSucceeded({ lastUsedAt: null, lastError: 'model_not_found' })).toBe(true)
  })
  it('is false once the row has succeeded, or when the error is not a missing model', () => {
    expect(neverSucceeded({ lastUsedAt: '2026-10-11T10:00:00Z', lastError: '404' })).toBe(false)
    expect(neverSucceeded({ lastUsedAt: null, lastError: 'groq returned 429 rate limit' })).toBe(false)
    expect(neverSucceeded({ lastUsedAt: null, lastError: null })).toBe(false)
  })
})

describe('modelSuggestions', () => {
  it('uses the live ids when we have them, so the owner sees real models', () => {
    expect(modelSuggestions(['gemini-3.8-flash'], [{ value: 'gemini-2.5-flash' }])).toEqual(['gemini-3.8-flash'])
  })
  it('falls back to the hard-coded map only when no live list exists', () => {
    expect(modelSuggestions(null, [{ value: 'openai/gpt-oss-120b' }])).toEqual(['openai/gpt-oss-120b'])
  })
  it('a freshly typed id is allowed even though it is not a suggestion', () => {
    // The combobox is free text: an id absent from suggestions is not rejected,
    // it is merely flagged by modelLooksRetired (shown above).
    const live = ['gemini-3.8-flash']
    expect(modelSuggestions(live, [])).toEqual(live)
    expect(modelLooksRetired('brand-new-model', live)).toBe(true)
  })
})
