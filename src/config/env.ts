/**
 * env.ts — All environment variables are accessed through this wrapper.
 * Most config lives in the Supabase settings table, not .env.
 * Only bootstrap credentials are here.
 */
export const env = {
  SUPABASE_URL:       import.meta.env.VITE_SUPABASE_URL       as string,
  SUPABASE_ANON_KEY:  import.meta.env.VITE_SUPABASE_ANON_KEY  as string,
  /** Feature flag: enable the new tab-based Exam Lifecycle Editor */
  NEW_EXAM_EDITOR:    import.meta.env.VITE_NEW_EXAM_EDITOR === 'true',
  FRONTEND_URL:       (import.meta.env.VITE_FRONTEND_URL as string) ?? 'https://indianexaminfo.com',
} as const;
