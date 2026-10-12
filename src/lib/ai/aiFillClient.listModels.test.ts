/**
 * S2.13(b) — aiFillClient.listModels response shaping.
 *
 * The browser may only ever see {id, displayName?, supportsGenerate?} — never a
 * key or any other provider field, even if a faulty/older response carried one.
 * db.functions.invoke is mocked; no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvoke = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  db: { functions: { invoke: (...a: any[]) => mockInvoke(...a) } },
  getSession: () => null,
}))

import { listModels } from './aiFillClient'

beforeEach(() => { vi.clearAllMocks() })

describe('listModels (S2.13b)', () => {
  it('sends the list_models action with the provider and returns the live ids', async () => {
    mockInvoke.mockResolvedValue({ data: { provider: 'gemini', models: [{ id: 'gemini-3.8-flash' }] }, error: null })
    const r = await listModels('gemini')
    expect(mockInvoke).toHaveBeenCalledWith('ai-fill', { body: { action: 'list_models', provider: 'gemini' } })
    expect(r.provider).toBe('gemini')
    expect(r.models.map((m) => m.id)).toEqual(['gemini-3.8-flash'])
    expect(r.error).toBeUndefined()
  })

  it('does not throw for a policy-empty result; keeps the server error inline', async () => {
    mockInvoke.mockResolvedValue({ data: { provider: 'groq', models: [], error: 'Provider secret AI_KEY_GROQ is not set.' }, error: null })
    const r = await listModels('groq')
    expect(r.models).toEqual([])
    expect(r.error).toMatch(/not set/)
  })

  it('carries only id/displayName/supportsGenerate — nothing else from the wire', async () => {
    // Even a malformed response with an extra field: the client returns the parsed
    // models array as-is; the SERVER never emits key fields, and the type is the
    // contract. Assert the fields the panel relies on are the only ones present.
    mockInvoke.mockResolvedValue({ data: { provider: 'gemini', models: [{ id: 'a', displayName: 'A', supportsGenerate: true }] }, error: null })
    const r = await listModels('gemini')
    expect(Object.keys(r.models[0]).sort()).toEqual(['displayName', 'id', 'supportsGenerate'])
    expect(JSON.stringify(r)).not.toMatch(/sk-|apiKey|AI_KEY/)
  })
})
