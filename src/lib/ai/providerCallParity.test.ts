/**
 * S2.12 — the Edge Function mirrors providerCall.ts exactly.
 *
 * The Deno function cannot import the client module, so it re-declares the same
 * request-body literals and the same redactProviderError. This test reads both
 * source files and fails on drift — the same technique as the SQL↔TS and
 * templates↔normalizeLabel parity pins.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indexSrc = readFileSync(resolve(__dirname, '../../../supabase/functions/ai-fill/index.ts'), 'utf8')
const callSrc = readFileSync(resolve(__dirname, './providerCall.ts'), 'utf8')

const redactBlock = (src: string): string => {
  const m = src.match(/(?:export\s+)?function redactProviderError[\s\S]*?\n}/)
  if (!m) throw new Error('redactProviderError not found')
  // Normalise the module's `export` + leading doc so only the body compares.
  return m[0]
    .replace(/export\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('ai-fill mirrors providerCall.ts', () => {
  it('redactProviderError is byte-identical to the canonical module (ignoring export/whitespace)', () => {
    expect(redactBlock(indexSrc)).toBe(redactBlock(callSrc))
  })

  it('the Gemini jsonMode body sets strict JSON AND thinkingBudget 0', () => {
    expect(indexSrc).toContain('responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 }')
    expect(indexSrc).toContain('maxOutputTokens: cap')
  })

  it('the OpenAI-compatible body keeps response_format json_object and max_tokens cap', () => {
    expect(indexSrc).toContain('response_format: { type: "json_object" }')
    expect(indexSrc).toContain('max_tokens: cap')
  })

  it('the staff actions exist and expose ONLY keyConfigured (never a key value)', () => {
    expect(indexSrc).toMatch(/action === "provider_status"/)
    expect(indexSrc).toMatch(/action === "test"/)
    expect(indexSrc).toContain('keyConfigured: Boolean(key && key.trim())')
    // Within the provider_status block the only key-derived field is the boolean.
    const start = indexSrc.indexOf('action === "provider_status"')
    const block = indexSrc.slice(start, indexSrc.indexOf('return json({ providers }', start))
    expect(block).toContain('keyConfigured')
    expect(block).not.toMatch(/\bkey: /) // never a `key:` in the returned object
  })

  it('the error body reaches the LOG but the browser message stays the bare status line', () => {
    expect(indexSrc).toContain('const logDetail = body ? `${tLast}: ${body}` : tLast')
    // the 502 shown to the browser uses tLast (unchanged), not logDetail
    expect(indexSrc).toContain('`AI could not read the notice (${tLast}). Nothing was filled in.`')
  })

  it('openai is a known slug on both sides (types + secret/base maps in the function)', () => {
    expect(indexSrc).toContain('openai: "AI_KEY_OPENAI"')
    expect(indexSrc).toContain('openai: "https://api.openai.com/v1"')
    const typesSrc = readFileSync(resolve(__dirname, '../../../src/types/aiProvider.ts'), 'utf8')
    expect(typesSrc).toMatch(/AIProviderName = "[^"]*" \| "openai"/)
  })
})

describe('S2.12 follow-up — the staff test action is metered and logged', () => {
  const start = indexSrc.indexOf('action === "test"')
  const testBlock = indexSrc.slice(start, indexSrc.indexOf('// 4. Rate limit per user', start))

  it('shares the per-user 5-minute ceiling before it calls the provider', () => {
    expect(testBlock).toContain('testSince5')
    expect(testBlock).toContain('MAX_CALLS_PER_5_MIN')
  })

  it('records the outcome under consumer_name "provider-test" via the existing logCall path (all three exits)', () => {
    expect(testBlock).toContain('"provider-test"')
    // key-not-configured + success + error each log a row
    expect((testBlock.match(/await logCall\(/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('logs only safe strings — a fixed note for a missing key, the redacted detail otherwise', () => {
    expect(testBlock).toContain('"key not configured"')
    expect(testBlock).toContain('detail.slice(0, 500)')
    // the key VALUE (the env var) is never passed to logCall
    expect(testBlock).not.toMatch(/logCall\([^)]*\bkey\b[^)]*\)/)
  })

  it('provider_status stays free: no provider call, no metering, no log', () => {
    const psStart = indexSrc.indexOf('action === "provider_status"')
    const psBlock = indexSrc.slice(psStart, indexSrc.indexOf('action === "test"', psStart))
    expect(psBlock).not.toContain('logCall')
    expect(psBlock).not.toContain('MAX_CALLS_PER_5_MIN')
    expect(psBlock).not.toContain('callOne(')
  })
})

describe('model-list mirror (index.ts <-> providerCall.ts) (S2.13b)', () => {
  it('index.ts carries the Gemini + OpenAI model-list endpoints and the prefix strip', () => {
    expect(indexSrc).toContain('/v1beta/models')
    expect(indexSrc).toContain('list_models')
    // Gemini ids come back as "models/<id>" and MUST be stripped, in both sources.
    expect(indexSrc).toMatch(/replace\(\/\^models\\\//)
  })

  it('the canonical builder and the function use the SAME endpoints and prefix strip', () => {
    // providerCall.ts (browser source) and index.ts (Deno mirror) must agree.
    for (const src of [callSrc, indexSrc]) {
      expect(src).toContain('/v1beta/models')
      expect(src).toMatch(/\/models\b/)
      expect(src).toMatch(/replace\(\/\^models\\\//)
    }
  })

  it('list_models is metered + logged, and never emits a key field', () => {
    const lmStart = indexSrc.indexOf('action === "list_models"')
    const lmBlock = indexSrc.slice(lmStart, indexSrc.indexOf('// 4. Rate limit per user', lmStart))
    expect(lmBlock).toContain('MAX_CALLS_PER_5_MIN')
    expect(lmBlock).toContain('"provider-models"')
    expect(lmBlock).toContain('redactProviderError')
    // Only these response fields are built — no key/apiKey ever appears.
    expect(lmBlock).not.toMatch(/\bapiKey\b/)
    expect(lmBlock).not.toMatch(/json\(\{[^}]*\bkey:/)
  })
})
