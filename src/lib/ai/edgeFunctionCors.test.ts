/**
 * Structural guard: every public Edge Function the browser calls must answer the
 * CORS preflight with the headers the client actually sends. The CMS/frontend
 * always sends `apikey` + `Authorization` (non-simple headers → an OPTIONS
 * preflight is required); if a function's `Access-Control-Allow-Headers` omits
 * them, the browser blocks the POST and the user sees a generic network error.
 *
 * This is exactly how `submit-message` broke the reader "Report an error" flow —
 * its preflight allowed only `content-type`. The Playwright e2e mocked the route,
 * so it never exercised a real preflight and could not catch it. This test reads
 * the function SOURCE (as providerCallParity does) and fails if the allow-list
 * drops a required header.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FUNCTIONS: Record<string, string> = {
  'ai-fill': resolve(__dirname, '../../../supabase/functions/ai-fill/index.ts'),
  'submit-message': resolve(__dirname, '../../../supabase/functions/submit-message/index.ts'),
}

describe('edge function CORS preflight allows the headers the client sends', () => {
  for (const [name, path] of Object.entries(FUNCTIONS)) {
    it(`${name}: Access-Control-Allow-Headers includes authorization + apikey + content-type`, () => {
      const src = readFileSync(path, 'utf8')
      const m = src.match(/Access-Control-Allow-Headers['"]?\s*[:=]\s*['"]([^'"]+)['"]/)
      expect(m, `${name}: no Access-Control-Allow-Headers literal found`).toBeTruthy()
      const allowed = m![1].toLowerCase()
      expect(allowed).toContain('authorization')
      expect(allowed).toContain('apikey')
      expect(allowed).toContain('content-type')
    })
  }
})
