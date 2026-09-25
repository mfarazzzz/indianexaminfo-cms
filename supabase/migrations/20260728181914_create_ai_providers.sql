
-- =============================================================================
-- AI PROVIDERS — Multi-provider key management with fallback chain
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL CHECK (provider IN ('groq', 'gemini', 'cerebras', 'mistral', 'openrouter')),
  label       text NOT NULL,
  api_key     text NOT NULL,
  model       text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  priority    integer NOT NULL,
  last_used_at timestamptz,
  last_error  text,
  usage_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, label)
);

-- Auto-assign priority on insert
CREATE OR REPLACE FUNCTION ai_providers_auto_priority()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.priority IS NULL OR NEW.priority = 0 THEN
    SELECT COALESCE(MAX(priority), 0) + 1 INTO NEW.priority FROM ai_providers;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_providers_auto_priority
  BEFORE INSERT ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION ai_providers_auto_priority();

-- Auto-update updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_providers"
  ON ai_providers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_write_ai_providers"
  ON ai_providers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_update_ai_providers"
  ON ai_providers FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_delete_ai_providers"
  ON ai_providers FOR DELETE
  USING (current_user_role() IN ('super-admin', 'admin'));

-- =============================================================================
-- AI REQUEST LOGS — Track each AI call for debugging and usage stats
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_request_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid REFERENCES ai_providers(id) ON DELETE SET NULL,
  prompt_hash   text NOT NULL,
  status        text NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  latency_ms    integer NOT NULL,
  consumer_name text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_request_logs_created_at ON ai_request_logs(created_at DESC);
CREATE INDEX idx_ai_request_logs_provider_id ON ai_request_logs(provider_id);

ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_logs"
  ON ai_request_logs FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_write_ai_logs"
  ON ai_request_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- MIGRATE EXISTING KEYS from settings table to ai_providers
-- =============================================================================

DO $$
DECLARE
  v_key TEXT;
  v_model TEXT;
  v_provider TEXT;
BEGIN
  -- Key 1: gemini_api_key
  SELECT TRIM(BOTH '"' FROM (value::TEXT)) INTO v_key FROM settings WHERE key = 'gemini_api_key';
  SELECT TRIM(BOTH '"' FROM (value::TEXT)) INTO v_model FROM settings WHERE key = 'gemini_model';
  v_model := COALESCE(NULLIF(v_model, ''), 'llama-3.3-70b-versatile');
  IF v_key IS NOT NULL AND LENGTH(v_key) > 5 THEN
    v_provider := CASE WHEN v_key LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Primary (migrated)', v_key, v_model, 1)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;

  -- Key 2: ai_fallback_key
  SELECT TRIM(BOTH '"' FROM (value::TEXT)) INTO v_key FROM settings WHERE key = 'ai_fallback_key';
  SELECT TRIM(BOTH '"' FROM (value::TEXT)) INTO v_model FROM settings WHERE key = 'ai_fallback_model';
  v_model := COALESCE(NULLIF(v_model, ''), 'llama-3.3-70b-versatile');
  IF v_key IS NOT NULL AND LENGTH(v_key) > 5 THEN
    v_provider := CASE WHEN v_key LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Fallback 1 (migrated)', v_key, v_model, 2)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;

  -- Key 3: ai_key_3
  SELECT TRIM(BOTH '"' FROM (value::TEXT)) INTO v_key FROM settings WHERE key = 'ai_key_3';
  IF v_key IS NOT NULL AND LENGTH(v_key) > 5 THEN
    v_provider := CASE WHEN v_key LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Fallback 2 (migrated)', v_key,
      CASE WHEN v_key LIKE 'gsk_%' THEN 'llama-3.3-70b-versatile' ELSE 'gemini-2.5-flash' END, 3)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;
END $$;
;
