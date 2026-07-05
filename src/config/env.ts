/**
 * env.ts — Bootstrap environment variables.
 * Most configuration lives in the Supabase settings table, not .env.
 * Only Supabase credentials and the frontend URL are sourced from env.
 */
export const env = {
  SUPABASE_URL:      import.meta.env.VITE_SUPABASE_URL      as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  FRONTEND_URL:      (import.meta.env.VITE_FRONTEND_URL as string) ?? 'https://indianexaminfo.com',
} as const;
