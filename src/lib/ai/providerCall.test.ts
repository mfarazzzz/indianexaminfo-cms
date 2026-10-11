/**
 * S2.12 — provider-call behaviour, tested with a MOCKED fetch.
 *
 * providerCall.ts is the canonical builder/parser the Edge Function mirrors. The
 * callGeminiOnce helper below stands in for callOne's Gemini branch: it uses the
 * same request-body builder and response parser, driven by an injected fake
 * fetch, so the body shape and parsing are covered without any network.
 */
import { describe, expect, it } from 'vitest'
import {
  geminiRequestBody, openaiChatBody, parseGeminiText, parseOpenaiText, redactProviderError,
} from './providerCall'

/** A stand-in for ai-fill's callOne Gemini branch, fetch injected. */
async function callGeminiOnce(
  fetchImpl: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
  prompt: string, model: string, jsonMode: boolean, cap: number,
): Promise<string> {
  const body = geminiRequestBody(prompt, jsonMode, cap)
  const res = await fetchImpl(`https://gen/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: {}, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`gemini returned ${res.status}`)
  const text = parseGeminiText(await res.json())
  if (!text.trim()) throw new Error('gemini returned no text')
  return text
}

describe('geminiRequestBody', () => {
  it('jsonMode → responseMimeType application/json AND thinkingBudget 0', () => {
    const b = geminiRequestBody('p', true, 3000)
    expect(b.generationConfig.responseMimeType).toBe('application/json')
    expect(b.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
    expect(b.generationConfig.maxOutputTokens).toBe(3000)
    expect(b.generationConfig.temperature).toBe(0.05)
  })
  it('non-json → no responseMimeType, no thinkingConfig, temp 0.7', () => {
    const b = geminiRequestBody('p', false, 4096)
    expect(b.generationConfig.responseMimeType).toBeUndefined()
    expect(b.generationConfig.thinkingConfig).toBeUndefined()
    expect(b.generationConfig.temperature).toBe(0.7)
  })
})

describe('openaiChatBody', () => {
  it('jsonMode → response_format json_object and the given cap', () => {
    const b = openaiChatBody('p', 'gpt-4o-mini', true, 3000)
    expect(b.response_format).toEqual({ type: 'json_object' })
    expect(b.max_tokens).toBe(3000)
    expect(b.model).toBe('gpt-4o-mini')
  })
})

describe('response parsing', () => {
  it('parseGeminiText joins candidate parts', () => {
    expect(parseGeminiText({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab')
    expect(parseGeminiText({ candidates: [] })).toBe('')
    expect(parseGeminiText({})).toBe('')
  })
  it('parseOpenaiText reads the assistant message', () => {
    expect(parseOpenaiText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi')
    expect(parseOpenaiText({})).toBe('')
  })
})

describe('callGeminiOnce with a mocked fetch', () => {
  it('sends a strict-JSON, thinking-off request and parses the answer', async () => {
    let sentBody: any
    const fakeFetch = async (_url: string, init: { body: string }) => {
      sentBody = JSON.parse(init.body)
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"fields":{}}' }] } }] }) }
    }
    const out = await callGeminiOnce(fakeFetch as any, 'extract', 'gemini-2.5-flash', true, 3000)
    expect(out).toBe('{"fields":{}}')
    expect(sentBody.generationConfig.responseMimeType).toBe('application/json')
    expect(sentBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
    expect(sentBody.generationConfig.maxOutputTokens).toBe(3000)
  })

  it('an empty candidate list throws (never a silent empty extraction)', async () => {
    const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) })
    await expect(callGeminiOnce(fakeFetch as any, 'x', 'm', true, 3000)).rejects.toThrow(/no text/)
  })
})

describe('redactProviderError', () => {
  it('strips a Bearer token but keeps the prose', () => {
    const out = redactProviderError('invalid auth: Bearer gsk_abcdefghijklmnopqrstuvwxyz012345 for this request')
    expect(out).not.toContain('gsk_abcdefghijklmnopqrstuvwxyz012345')
    expect(out).toContain('Bearer [redacted]')
  })
  it('redacts a key=value / sk- / long-token form', () => {
    expect(redactProviderError('{"error":{"message":"bad api_key=sk-1234567890abcdef"}}')).not.toContain('sk-1234567890abcdef')
    expect(redactProviderError('token: abcdefghijklmnopqrstuvwxyz0123456789')).toContain('[redacted]')
  })
  it('leaves an ordinary short error code untouched and caps length at 300', () => {
    expect(redactProviderError('model_not_found')).toBe('model_not_found')
    expect(redactProviderError('x'.repeat(1000)).length).toBeLessThanOrEqual(300)
    expect(redactProviderError('')).toBe('')
  })
})
