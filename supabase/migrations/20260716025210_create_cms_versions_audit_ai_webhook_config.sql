CREATE TABLE IF NOT EXISTS cms_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, content_id UUID NOT NULL,
  version_number INT NOT NULL, snapshot JSONB NOT NULL,
  status TEXT NOT NULL, created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, content_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_versions_lookup ON cms_content_versions(content_type, content_id, version_number DESC);

CREATE TABLE IF NOT EXISTS cms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT, user_email TEXT, cms_role TEXT,
  action TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT,
  metadata JSONB, ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_audit_created ON cms_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cms_audit_user ON cms_audit_log(user_id);

CREATE TABLE IF NOT EXISTS cms_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL, used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), prompt_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON cms_ai_usage(user_id, used_at DESC);

CREATE TABLE IF NOT EXISTS cms_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, content_id UUID NOT NULL,
  target_url TEXT NOT NULL, status_code INT, error_message TEXT, attempt INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_system_config (
  key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO cms_system_config (key, value) VALUES ('ai_daily_limit', '{"limit": 20}') ON CONFLICT (key) DO NOTHING;;
