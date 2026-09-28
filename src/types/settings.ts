import type { Json } from "@/lib/supabase/types";

export type SettingGroup =
  | "general"
  | "database"
  | "ai"
  | "seo"
  | "notifications"
  | "integrations"
  | "ads"
  | "appearance";

export type Setting = {
  id: string;
  key: string;
  value: Json;
  group: SettingGroup;
  label: string;
  description: string | null;
  isSensitive: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

/** Typed settings object — keys match setting key column */
export type SettingsMap = {
  // General
  site_name: string;
  site_tagline: string;
  site_url: string;
  contact_email: string;
  whatsapp_number: string;
  telegram_channel: string;
  youtube_channel: string;
  posts_per_page: number;
  // Database. There is no service-role key entry on purpose: a service key in
  // this table would be readable by every admin session and was never needed -
  // the Edge Functions get it from project secrets.
  supabase_url: string;
  supabase_anon_key: string;
  db_status: "connected" | "disconnected";
  // AI. No API key belongs here - keys are Edge Function secrets (AI_KEY_*),
  // and the model choice lives in the ai_providers table.
  ai_enabled: boolean;
  ai_auto_seo: boolean;
  ai_auto_summary: boolean;
  ai_auto_faq: boolean;
  ai_language: "en" | "hi";
  ai_tone: "informative" | "formal" | "simple";
  // SEO
  ga_id: string;
  gsc_verify: string;
  default_og_image: string;
  adsense_id: string;
  robots_txt: string;
  // Notifications
  telegram_bot_token: string;
  telegram_post_channel: string;
  notify_on_publish: boolean;
  notify_on_result: boolean;
  telegram_template: string;
  // Integrations
  revalidate_token: string;
  frontend_url: string;
  revalidate_on_publish: boolean;
  // Ads
  default_ad_html: string;
  adsense_enabled: boolean;
  direct_ads_enabled: boolean;
  // Appearance
  primary_color: string;
  accent_color: string;
  editorial_color: string;
  logo_url: string;
  favicon_url: string;
  footer_tagline: string;
  [key: string]: Json;
};
