-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED (S2.12: OpenAI parity in the ai_providers vocabulary)
--
-- The `ai-fill` Edge Function and the CMS types already accept slug "openai"
-- (AIProviderName, PROVIDER_LABELS, PROVIDER_MODELS, SECRET_BY_PROVIDER /
-- BASE_URL_BY_PROVIDER), but the live CHECK constraint still rejects it, so an
-- OpenAI row cannot be saved from the panel. This migration widens the list to
-- match the code. The owner applies it deliberately; nothing here runs on its
-- own. Key material is UNTOUCHED — a key stays an Edge Function secret
-- (AI_KEY_OPENAI), never a value in this table.
--
-- Verified live constraint (read-only, 2026-10-11):
--   conname ai_providers_provider_check
--   def     CHECK (provider = ANY (ARRAY['groq','gemini','cerebras','mistral','openrouter']))
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ai_providers
  DROP CONSTRAINT IF EXISTS ai_providers_provider_check;

ALTER TABLE public.ai_providers
  ADD CONSTRAINT ai_providers_provider_check
  CHECK (provider = ANY (ARRAY[
    'groq'::text, 'openai'::text, 'gemini'::text,
    'cerebras'::text, 'mistral'::text, 'openrouter'::text
  ]));

-- Existing rows are a subset of the new list, so the ADD CONSTRAINT cannot fail
-- on data. No backfill, no insert, no key column touched.
