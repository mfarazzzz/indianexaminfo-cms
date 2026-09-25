CREATE TABLE IF NOT EXISTS cms_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  type TEXT NOT NULL DEFAULT 'adsense' CHECK (type IN ('adsense', 'image', 'html')),
  placement TEXT NOT NULL CHECK (placement IN ('header','sidebar','infeed','article_top','article_middle','article_bottom','footer','mobile_sticky','banner_1','banner_2','banner_3','banner_4','banner_5','banner_6','banner_7','banner_8','banner_9','banner_10')),
  code TEXT, image_url TEXT, target_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 100),
  weight INT DEFAULT 50,
  device_type TEXT DEFAULT 'all' CHECK (device_type IN ('all', 'mobile', 'desktop')),
  category TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES cms_ads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  ip_anonymous TEXT, page_url TEXT, placement TEXT, device_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_ad_events_ad ON cms_ad_events(ad_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cms_ad_events_date ON cms_ad_events(created_at);;
