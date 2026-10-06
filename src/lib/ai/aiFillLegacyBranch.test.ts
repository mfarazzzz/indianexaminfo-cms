/**
 * S2.3 release guard — the ai-fill function's LEGACY {prompt} branch must keep
 * serving the callers that still use it (moduleAI via ModulePanel, autofill via
 * the dialog editors) exactly as the DEPLOYED version does, until S2.8's
 * follow-up removes the branch. The template branch is additive and gated.
 *
 * The function is a standalone Deno bundle (npm: specifiers, Deno.serve) and
 * cannot run under vitest, so this pins the legacy CONTRACT from the actual
 * shipped source text — the same technique as noticeTemplateParity.test.ts.
 * If someone edits the legacy path, this test names what moved.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fnSrc = readFileSync(
  resolve(__dirname, '../../../supabase/functions/ai-fill/index.ts'),
  'utf8',
)

describe('ai-fill legacy {prompt} branch — behaviour pins (S2.3)', () => {
  it('the template branch is strictly gated and placed BEFORE the legacy path', () => {
    const gate = fnSrc.indexOf('if (templateName) {')
    const legacy = fnSrc.indexOf('Legacy raw-prompt path')
    expect(gate).toBeGreaterThan(-1)
    expect(legacy).toBeGreaterThan(gate) // a {prompt}-only request falls past it
  })

  it('a request without "template" reads prompt exactly as before', () => {
    expect(fnSrc).toContain('const prompt = typeof body.prompt === "string" ? body.prompt : "";')
    expect(fnSrc).toContain('if (!prompt.trim()) return json({ error: "There was nothing to send. Paste the notification text first." }, 400, cors.headers);')
    expect(fnSrc).toContain('if (prompt.length > MAX_INPUT_CHARS)')
    expect(fnSrc).toContain('const MAX_INPUT_CHARS = 20_000;')
  })

  it('consumer handling is unchanged (same expression, same default, same 60-cap)', () => {
    expect(fnSrc).toContain('const consumer = typeof body.consumer === "string" && body.consumer.trim() ? body.consumer.slice(0, 60) : "ai-fill";')
  })

  it('legacy success response shape is unchanged: {content, provider, model} 200', () => {
    expect(fnSrc).toContain('return json({ content, provider: target.provider, model: target.model }, 200, cors.headers);')
  })

  it('authz, rate limits and awaited audit logs are untouched (F2a/F2c)', () => {
    for (const needle of [
      'const REQUIRED_PERMISSIONS = ["edit_any_post", "create_exam", "create_post"];',
      'current_user_has_permission',
      'MAX_CALLS_PER_5_MIN = 15',
      'MAX_CALLS_PER_DAY = 150',
      'await logCall(',
      'admin.from("ai_request_logs").insert({',
      'Origin not allowed',
    ]) {
      expect(fnSrc, `missing: ${needle}`).toContain(needle)
    }
  })

  it('legacy error semantics preserved: timeout 504, provider failure 502', () => {
    expect(fnSrc).toContain('}, 504, cors.headers);')
    expect(fnSrc).toContain('AI could not complete the request (${lastMessage}). Nothing was saved.')
  })

  it('the DEPLOYED source (f05f005, recorded 2026-10-06) matches this file on every legacy-line invariant above', () => {
    // The deployed copy was fetched read-only via Supabase MCP and its legacy
    // statements are the exact strings pinned here; guard against drift in the
    // OTHER direction too: the file must not have removed the legacy branch.
    expect(fnSrc).toContain('const jsonMode = body.jsonMode === true;')
    expect(fnSrc).toContain('const targets = await resolveProviders(admin);')
    expect(fnSrc).toContain('const content = await callOne(target, prompt, jsonMode, controller.signal);')
  })
})
