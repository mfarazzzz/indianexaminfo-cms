import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/config/env";

const IS_DEV_MODE =
  !env.SUPABASE_URL || env.SUPABASE_URL === "https://your-project.supabase.co";

if (!IS_DEV_MODE && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment. " +
    "Create a .env file at the root of indianexaminfo-cms/."
  );
}

// In dev mode use stub values so createClient doesn't crash.
export const supabase = createClient<Database>(
  IS_DEV_MODE ? "https://placeholder.supabase.co" : env.SUPABASE_URL,
  IS_DEV_MODE ? "placeholder-anon-key" : env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Untyped client alias — used in services to avoid complex generic inference issues.
// All data is manually typed via mapRow functions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;
