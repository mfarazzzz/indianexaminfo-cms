/**
 * S2.16 — the JSON-mode 400 fallback (server, template path).
 *
 * Evidence: ai_request_logs 2026-10-15 13:27:34 —
 *   groq returned 400: {"error":{"message":"Failed to validate JSON. Please
 *   adjust your prompt. See 'failed_generation' for more details.",
 *   "code":"json_validate_failed","failed_generation":""}}
 * The model produced NOTHING under `response_format: json_object`, and with
 * Gemini 503 the whole chain died as a 502. The fix is one extra attempt on the
 * SAME provider without the constraint, read tolerantly.
 *
 * The pure helpers live in the function's templates.ts (no Deno APIs), so they
 * are imported and executed here. The control flow lives in index.ts, a Deno
 * bundle that cannot be imported — it is pinned structurally, the way
 * aiFillLegacyBranch.test.ts and noticeYield.test.ts pin theirs.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractJsonObject, isJsonValidateFailed, JSON_ONLY_REMINDER,
  classifyRetryFailure, retryFailureHeadline,
} from '../../../supabase/functions/ai-fill/templates.ts'

const indexSrc = readFileSync(
  resolve(__dirname, '../../../supabase/functions/ai-fill/index.ts'), 'utf8',
).replace(/\r\n/g, '\n')

/** The body Groq actually sent, redacted the way the function redacts it. */
const GROQ_BODY = '{"error":{"message":"Failed to validate JSON. Please adjust your prompt. See \'failed_generation\' for more details.","type":"invalid_request_error","code":"json_validate_failed","failed_generation":""}}'

describe('S2.16 isJsonValidateFailed: only this one failure class', () => {
  it('matches the real groq 400 on an OpenAI-compatible provider', () => {
    expect(isJsonValidateFailed(400, GROQ_BODY, 'openai-compatible')).toBe(true)
  })

  it('matches by code OR by message, so a reworded body is still recognised', () => {
    expect(isJsonValidateFailed(400, '{"error":{"code":"json_validate_failed"}}', 'openai-compatible')).toBe(true)
    expect(isJsonValidateFailed(400, '{"error":{"message":"Failed to validate JSON."}}', 'openai-compatible')).toBe(true)
  })

  it('never fires on 429, 413, 503 or 404 — with or without the JSON wording', () => {
    for (const status of [429, 413, 503, 404, 500, 502]) {
      expect(isJsonValidateFailed(status, GROQ_BODY, 'openai-compatible'), `${status} must not retry`).toBe(false)
      expect(isJsonValidateFailed(status, 'json_validate_failed', 'openai-compatible'), `${status} must not retry`).toBe(false)
    }
  })

  it('a 400 that is NOT about JSON validation is not retried either (status alone is never enough)', () => {
    for (const body of [
      '{"error":{"code":"insufficient_quota"}}',
      '{"error":{"message":"Your input was flagged by our moderation system"}}',
      '{"error":{"message":"context length exceeded"}}',
      '',
    ]) {
      expect(isJsonValidateFailed(400, body, 'openai-compatible'), `must not retry: ${body}`).toBe(false)
    }
  })

  it('the Gemini adapter never gets this treatment (it uses responseMimeType)', () => {
    expect(isJsonValidateFailed(400, GROQ_BODY, 'gemini')).toBe(false)
  })

  it('a missing status (a thrown fetch error, not an HTTP response) is not a retry', () => {
    expect(isJsonValidateFailed(undefined, GROQ_BODY, 'openai-compatible')).toBe(false)
  })
})

describe('S2.16 extractJsonObject: read an answer that is not clean JSON', () => {
  const obj = '{"fields":{"name":{"value":"X"}},"dates":[{"label":"L","dateText":"05.10.2026"}]}'

  it('a fenced answer parses', () => {
    expect(extractJsonObject('```json\n' + obj + '\n```')).toBe(obj)
  })

  it('a prose-wrapped answer parses (before AND after)', () => {
    expect(extractJsonObject('Here is the extraction result:\n' + obj + '\nLet me know if you need anything else.')).toBe(obj)
    expect(extractJsonObject('```json\n' + obj + '\n```\nThat is the complete record.')).toBe(obj)
  })

  it('nested objects and a brace inside a string do not end the scan early', () => {
    const nested = '{"a":{"b":{"c":1}},"note":"has } brace inside","dates":[{"label":"x {y"}]}'
    expect(extractJsonObject('prose ' + nested + ' trailing prose {"unclosed')).toBe(nested)
    expect(extractJsonObject(nested)).toBe(nested)
  })

  it('an escaped quote inside a string does not close the string', () => {
    const withEscape = '{"value":"say \\"hello\\" } here","ok":true}'
    expect(extractJsonObject(withEscape)).toBe(withEscape)
    expect(() => JSON.parse(withEscape as string)).not.toThrow()
  })

  it('only the FIRST top-level object is taken (a doubled answer is not merged)', () => {
    expect(extractJsonObject(obj + '\n' + obj)).toBe(obj)
  })

  it('a TRUNCATED generation fails cleanly — null, not half an object', () => {
    expect(extractJsonObject(obj.slice(0, obj.length - 12))).toBe(null)
    expect(extractJsonObject('{"fields":{"name":{"value":"X"}},"dates":[')).toBe(null)
  })

  it('no JSON at all is null (the caller then logs the retry as failed and moves on)', () => {
    expect(extractJsonObject('I could not read that notice.')).toBe(null)
    expect(extractJsonObject('')).toBe(null)
    expect(extractJsonObject('{"never closes"}')).toBe('{"never closes"}') // balanced pair, valid JSON
  })

  it('whatever it returns is parseable, so JSON.parse(extractJsonObject(x)) cannot half-succeed', () => {
    for (const sample of ['```json\n' + obj + '\n```', 'text ' + obj, obj + ' tail']) {
      const got = extractJsonObject(sample)
      expect(got).toBeTruthy()
      expect(() => JSON.parse(got!)).not.toThrow()
    }
  })
})

describe('S2.16 the retry reminder text', () => {
  it('is the exact line the owner specified', () => {
    expect(JSON_ONLY_REMINDER).toBe('Return ONLY the JSON object, no prose, no code fences.')
  })
})

// v12 — the retry used to log a bare marker, so a failed fallback could not be
// told apart from any other failed provider attempt, and the 502 named whichever
// provider last went through the ordinary transport catch (often Gemini, even
// when Groq was the fatal one).
describe('v12 classifyRetryFailure: what kind of failure the retry hit', () => {
  it('an HTTP error on the retry carries its status', () => {
    expect(classifyRetryFailure(429, 'groq returned 429')).toBe('http_429')
    expect(classifyRetryFailure(400, 'groq returned 400')).toBe('http_400')
    expect(classifyRetryFailure(503, 'gemini returned 503')).toBe('http_503')
  })

  it('an empty message (the failed_generation class) is no_text, not invalid_json', () => {
    expect(classifyRetryFailure(undefined, 'groq returned no text')).toBe('no_text')
  })

  it('a truncated generation is no_json_object', () => {
    expect(classifyRetryFailure(undefined, 'retry answer had no complete JSON object')).toBe('no_json_object')
  })

  it('a balanced object that will not parse is invalid_json', () => {
    expect(classifyRetryFailure(undefined, '{"a": } is not valid JSON')).toBe('invalid_json')
    expect(classifyRetryFailure(undefined, 'Unexpected token < in JSON at position 0')).toBe('invalid_json')
  })

  it('anything else (an abort, a fetch failure) is a plain error', () => {
    expect(classifyRetryFailure(undefined, 'The operation was aborted.')).toBe('error')
    expect(classifyRetryFailure(undefined, 'fetch failed')).toBe('error')
  })

  it('a status always wins over the message text', () => {
    expect(classifyRetryFailure(500, 'retry answer had no complete JSON object')).toBe('http_500')
  })
})

describe('v12 retryFailureHeadline: the 502 names the provider that actually failed', () => {
  it('an HTTP error keeps the existing "<provider> returned <status>" shape', () => {
    expect(retryFailureHeadline('groq', 'http_429')).toBe('groq returned 429 after a retry')
  })

  it('every other cause says no readable answer, in plain words', () => {
    for (const kind of ['no_text', 'no_json_object', 'invalid_json', 'error']) {
      expect(retryFailureHeadline('groq', kind)).toBe('groq returned no readable answer after a retry')
    }
  })

  it('never says "timed out", so it cannot be mistaken for the overall guard', () => {
    for (const kind of ['http_408', 'no_text', 'error']) {
      expect(retryFailureHeadline('groq', kind)).not.toBe('timed out')
    }
  })

  it('carries no body content — the diagnosis belongs in ai_request_logs', () => {
    const line = retryFailureHeadline('groq', 'http_400')
    expect(line).not.toContain('json_validate_failed')
    expect(line).not.toContain('{')
  })
})

describe('S2.16 deployed handler: structural guards on index.ts', () => {
  it('the fallback is gated on the detector, not on the status number', () => {
    expect(indexSrc).toContain('if (!isJsonValidateFailed((callErr as { status?: number })?.status, (callErr as { body?: string })?.body ?? "", target.kind)) throw callErr;')
  })

  it('the retry is the ONLY call made without response_format, and keeps jsonMode sampling', () => {
    expect((indexSrc.match(/omitResponseFormat: true/g) || []).length).toBe(1)
    expect(indexSrc).toContain('...(jsonMode && !opts?.omitResponseFormat ? { response_format: { type: "json_object" } } : {})')
    // temperature is still driven by jsonMode, so the retry samples at 0.05
    expect(indexSrc).toContain('temperature: jsonMode ? 0.05 : 0.7,')
    // and the cap is the same constant, not a new budget
    expect(indexSrc).toContain('TEMPLATE_MAX_OUTPUT_TOKENS, { omitResponseFormat: true },')
  })

  it('the prompt gets the reminder as an extra LAST line, and only on the retry', () => {
    expect(indexSrc).toContain('`${prompt}\\n\\n${JSON_ONLY_REMINDER}`')
    const primary = indexSrc.indexOf('content = await callOne(target, prompt, true, tcontroller.signal, TEMPLATE_MAX_OUTPUT_TOKENS);')
    const retry = indexSrc.indexOf('const retryText = await callOne(')
    expect(primary).toBeGreaterThan(-1)
    expect(retry).toBeGreaterThan(primary) // the retry is inside the catch, after the primary call
  })

  it('NEVER more than one retry per provider per call — the loop body has one retry and its failure path leaves the provider', () => {
    expect((indexSrc.match(/const retryText = await callOne\(/g) || []).length).toBe(1)
    const retryIdx = indexSrc.indexOf('const retryText = await callOne(')
    // the whole retry branch, up to the strict-parse guard that follows it — no
    // fixed-width window, which silently truncates as comments grow
    const afterRetry = indexSrc.slice(retryIdx, indexSrc.indexOf('if (content !== null) {'))
    // its catch logs the marker WITH its cause and `continue`s — so the same
    // provider cannot be retried twice
    expect(afterRetry).toContain('const rKind = classifyRetryFailure(rStatus, rMsg);')
    expect(afterRetry).toContain('`json_mode_400_retry: ${rKind}')
    expect(afterRetry).toContain('await logCall(admin, target.providerId, userId, hash, "error", rDetail, Date.now() - attemptStart, consumer);')
    expect(afterRetry).toContain('continue;')
    // and there is no second callOne between that catch and the strict-parse guard
    const callOnesInBlock = (indexSrc.slice(retryIdx, indexSrc.indexOf('if (content !== null) {')) .match(/await callOne\(/g) || [])
    expect(callOnesInBlock.length).toBe(1)
  })

  it('v12: a failed retry sets tLast, so the eventual 502 names THIS provider', () => {
    const retryIdx = indexSrc.indexOf('const retryText = await callOne(')
    const block = indexSrc.slice(retryIdx, indexSrc.indexOf('if (content !== null) {'))
    expect(block).toContain('tLast = retryFailureHeadline(target.provider, rKind);')
    // the retry branch sets it, not the ordinary transport catch below
    expect(indexSrc.indexOf('tLast = retryFailureHeadline')).toBeLessThan(
      indexSrc.indexOf('const aborted = tcontroller.signal.aborted;'),
    )
  })

  it('a failed retry costs the caller nothing but time: it falls through, it is never a 502 of its own', () => {
    const retryIdx = indexSrc.indexOf('const retryText = await callOne(')
    const block = indexSrc.slice(retryIdx, indexSrc.indexOf('if (content !== null) {'))
    // asserted on the RESPONSE form, not the bare digits: the comments in that
    // block legitimately write "502" to explain the rule.
    expect(block).not.toContain('502, cors.headers')
    expect(block).not.toContain('return json({ error')
  })

  it('the 400 itself is still audited, with the same redacted detail the transport catch would have written', () => {
    const retryIdx = indexSrc.indexOf('const retryText = await callOne(')
    const before = indexSrc.slice(indexSrc.indexOf('} catch (callErr) {'), retryIdx)
    expect(before).toContain('const cDetail = (cBody ? `${cMsg}: ${cBody}` : cMsg).slice(0, 500);')
    expect(before).toContain('await logCall(admin, target.providerId, userId, hash, "error", cDetail, Date.now() - attemptStart, consumer);')
    expect(before).toContain('last_error: cDetail')
    // both the 400 row and the retry row are capped at 500 chars like every other
    // provider error row, and neither can carry a key (readErrorBody redacts)
    expect((indexSrc.match(/\.slice\(0, 500\)/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('the retry answer still goes through validateAnswer and the v10 gate', () => {
    const validated = indexSrc.indexOf('const validated = validateAnswer(parsed, options);')
    const retryIdx = indexSrc.indexOf('parsed = JSON.parse(objText);')
    expect(retryIdx).toBeGreaterThan(-1)
    expect(retryIdx).toBeLessThan(validated)
    expect(validated).toBeLessThan(indexSrc.indexOf('if (isLowYield(distinctDates, rowsReturned)) {'))
  })

  it('the strict parse (and its "not JSON" 502) still guards the NORMAL path unchanged', () => {
    expect(indexSrc).toContain('if (content !== null) {')
    expect(indexSrc).toContain('"template answer was not JSON"')
    expect(indexSrc).toContain('AI could not read part of the notice: the model did not answer in the required JSON shape.')
  })

  it('the legacy {prompt} branch and the Gemini adapter are untouched by any of this', () => {
    const legacy = indexSrc.indexOf('── Legacy raw-prompt path')
    expect(legacy).toBeGreaterThan(-1)
    expect(indexSrc.slice(legacy)).not.toContain('omitResponseFormat')
    expect(indexSrc.slice(legacy)).not.toContain('extractJsonObject')
    const geminiBranch = indexSrc.slice(indexSrc.indexOf('if (target.kind === "gemini") {'), indexSrc.indexOf('const res = await fetch(`${target.baseUrl}/chat/completions`'))
    expect(geminiBranch).toContain('responseMimeType: "application/json"')
    expect(geminiBranch).not.toContain('omitResponseFormat')
  })

  it('the Gemini request body still has no notion of the fallback (parity guard untouched)', () => {
    expect(indexSrc).toContain('response_format: { type: "json_object" }')
    expect(indexSrc).toContain('max_tokens: cap')
  })
})
