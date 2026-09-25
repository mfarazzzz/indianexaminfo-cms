CREATE TABLE IF NOT EXISTS cms_users (
  id BIGSERIAL PRIMARY KEY,
  supabase_uid UUID UNIQUE,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  full_name TEXT,
  cms_role TEXT NOT NULL DEFAULT 'author' CHECK (cms_role IN ('super_admin','admin','editor','author','reporter','contributor','advertiser')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  author_id UUID REFERENCES cms_authors(id) ON DELETE SET NULL,
  ai_generation_allowed BOOLEAN,
  ai_daily_limit INT,
  last_active_at TIMESTAMPTZ,
  created_by_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('super_admin','admin','editor','author','reporter','contributor','advertiser')),
  display_name TEXT NOT NULL, rank INT NOT NULL, ai_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL, resource TEXT NOT NULL, action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','own')),
  UNIQUE(role, resource, action)
);

CREATE TABLE IF NOT EXISTS cms_ai_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL UNIQUE REFERENCES cms_users(id) ON DELETE CASCADE,
  granted_by BIGINT REFERENCES cms_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS cms_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_limit INT NOT NULL DEFAULT 20,
  updated_by BIGINT REFERENCES cms_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO cms_ai_config (daily_limit) VALUES (20) ON CONFLICT DO NOTHING;;
