import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/config/env";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment. " +
    "Ensure the .env file at the root of indianexaminfo-cms/ is populated."
  );
}

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
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
