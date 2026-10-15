/**
 * S2.14b v9 — the compacted NOTICE_EXTRACT_V1 prompt must stay small AND keep
 * every rule the compaction was supposed to preserve.
 *
 * Why this test exists: v9 shortens the v8 additions (vacancy / important_links
 * / notes schema + their rules + SOURCE HYGIENE) from 2,927 to 1,475 chars,
 * because Groq meters a request as prompt + max_completion_tokens against its
 * 8,000 TPM and the UP D.El.Ed notice hit HTTP 413 ("Limit 8000, Requested
 * 8208") on 14 Oct 2026. Compaction is only safe if the RULES survive it, so
 * each of them is asserted as a literal token here, and the size budget is
 * asserted so a future edit that re-inflates the prompt fails CI instead of
 * quietly reintroducing the 413. See docs/design/ai-fill-prompt-compact-proposal.md.
 *
 * Same technique as noticeTemplateParity.test.ts: the Edge Function is a
 * standalone Deno bundle, so this file is read as TEXT and sliced on anchors
 * that exist inside the prompt string.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fnDir = resolve(__dirname, '../../../supabase/functions/ai-fill')
/**
 * The function files are checked out with CRLF on Windows (core.autocrlf=true),
 * but the body deployed to Supabase is LF, and prompt size is a per-line
 * question — so every measurement here is taken on LF-normalised text. Without
 * this the multi-line anchors below would not match on a Windows checkout.
 */
const templatesSrc = readFileSync(resolve(fnDir, 'templates.ts'), 'utf8').replace(/\r\n/g, '\n')
const indexSrc = readFileSync(resolve(fnDir, 'index.ts'), 'utf8').replace(/\r\n/g, '\n')

/** The prompt text between two literal anchors (both must exist, in order). */
function promptSlice(from: string, to: string, what: string): string {
  const a = templatesSrc.indexOf(from)
  const b = templatesSrc.indexOf(to)
  expect(a, `templates.ts prompt must contain "${from}" (${what})`).toBeGreaterThanOrEqual(0)
  expect(b, `templates.ts prompt must contain "${to}" (${what})`).toBeGreaterThan(a)
  return templatesSrc.slice(a, b)
}

// The three v8-added blocks, exactly as they now read in the prompt.
const schemaBlock = promptSlice('  "vacancy": {', '\n}\n\nDATE RULES', 'schema')
const rulesBlock = promptSlice('VACANCY / LINKS / NOTES RULES', 'SOURCE HYGIENE', 'rules')
const hygieneBlock = promptSlice('SOURCE HYGIENE (aggregator', 'NON-CONTENT:', 'hygiene')
const v8Additions = [schemaBlock, rulesBlock, hygieneBlock].join('\n')

describe('ai-fill v9: the compacted v8 additions stay inside the budget', () => {
  it('all three blocks together are <= 1,600 chars (v8 measured 2,927, v9 measures 1,475)', () => {
    expect(v8Additions.length).toBeLessThanOrEqual(1600)
  })

  it('the compacted text is at least 40% smaller than the v8 text it replaces', () => {
    // 2,927 chars was the measured v8 size; a 40% cut is the point of the change.
    expect(v8Additions.length).toBeLessThanOrEqual(Math.floor(2927 * 0.6))
  })
})

describe('ai-fill v9: every rule the compaction had to preserve is still there', () => {
  const tokens: [string, string][] = [
    ['vacancy total is only ever copied, never computed', 'ONLY if the notice PRINTS it'],
    ['never add posts up into a total', 'NEVER add the posts up'],
    ['post-wise breakdown only when listed', 'ONLY when the notice lists individual posts'],
    ['nothing about a post may be invented', 'invent nothing'],
    ['the three fields are optional', 'OPTIONAL'],
    ['a link needs its address in the text', 'address literally appears'],
    ['a label with no address is dropped, not guessed', 'no address is omitted'],
    ['an invented URL is a failure, not a draft', 'invented URL is a serious failure'],
    ['copy the URL as printed (the platform cleans the rest)', 'Copy the URL exactly as printed'],
    ['relative / TBN lines have no absolute date', 'NO absolute date'],
    ['such a line never becomes a dated row', 'NEVER in "dates"'],
    ['the quote is still demanded', 'verbatim'],
    ['aggregator chrome is ignored', 'IGNORE page CHROME'],
    ['only notice facts are extracted', 'Extract ONLY notice facts'],
    ['the page prose is never republished', "never reproduce the page's prose"],
    ['the link kind vocabulary is spelled out in full', 'official, apply, notification, short_notice, result, admit_card, answer_key, other'],
  ]
  for (const [name, token] of tokens) {
    it(name, () => {
      expect(v8Additions, `compacted prompt lost "${token}"`).toContain(token)
    })
  }

  it('the sections v9 must NOT touch are still verbatim', () => {
    expect(templatesSrc).toContain('- EXCEPTION — the APPLICATION/REGISTRATION window is TWO rows, never merged')
    expect(templatesSrc).toContain('You are extracting structured data from ONE official Indian exam/admission notice.')
    expect(templatesSrc).toContain('registration_start (opening date, type application_start)')
    expect(templatesSrc).toContain('पूर्व प्रकाशित विज्ञप्ति दिनांक 07.08.2026')
    expect(templatesSrc).toContain('NON-CONTENT: distribution lists')
    expect(templatesSrc).toContain('"suggestedNewOption"')
    expect(templatesSrc).toContain('"rank_batch"')
  })

  it('the removed v8 wording is really gone (no duplicated rules left behind)', () => {
    for (const gone of [
      'VACANCY RULES:', 'IMPORTANT-LINKS RULES:', 'NOTES RULES (relative',
      'BIG total number of posts/vacancy', 'Goods Train Manager: 2750',
      'the platform cleans tracking parameters itself', 'social widgets',
    ]) {
      expect(templatesSrc, `v9 should have removed "${gone}"`).not.toContain(gone)
    }
  })
})

describe('ai-fill v9: the template output cap is 2500 and env-overridable', () => {
  it('reads AI_TEMPLATE_MAX_OUTPUT_TOKENS and defaults to 2500', () => {
    expect(indexSrc).toContain('AI_TEMPLATE_MAX_OUTPUT_TOKENS')
    const m = indexSrc.match(/const TEMPLATE_MAX_OUTPUT_TOKENS = \(\(\) => \{([\s\S]*?)\}\)\(\);/)
    expect(m, 'TEMPLATE_MAX_OUTPUT_TOKENS must be the v9 env-overridable IIFE').toBeTruthy()
    expect(m![1]).toContain('Number.isFinite(raw) && raw > 0')
    expect(m![1], 'blank / invalid / <=0 must fall back to 2500').toContain(': 2500;')
  })

  it('the old hardcoded 3000 cap is gone', () => {
    expect(indexSrc).not.toMatch(/const TEMPLATE_MAX_OUTPUT_TOKENS = 3000/)
    // ...and the legacy path keeps its own untouched default.
    expect(indexSrc).toContain('const cap = maxTokens ?? (jsonMode ? 8192 : 4096);')
  })

  it('the template call still passes the cap explicitly', () => {
    expect(indexSrc).toContain('callOne(target, prompt, true, tcontroller.signal, TEMPLATE_MAX_OUTPUT_TOKENS)')
  })
})
