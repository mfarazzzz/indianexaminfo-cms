// admin-set-temp-password
//
// Sets a TEMPORARY password for a target user, on behalf of an admin, for the case
// where invite/reset email delivery fails. Requires the service-role key, which cannot
// run in the browser (the CMS SPA uses the anon key), so this lives in an Edge Function.
//
// Guarantees:
//  - Gated behind the manage_users permission, checked against the DATABASE using the
//    caller's JWT (not a UI flag). A caller without manage_users is refused here.
//  - Sets must_change_password = true on the target so the CMS forces a change at first
//    login before any other route.
//  - Returns the temporary password to the admin ONCE in the response. It is never
//    written to any table, log, or column.
//
// verify_jwt = true: the platform rejects requests without a valid JWT before this runs.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Generate a strong temporary password: >= 14 chars, letters + digits + symbol.
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < 16; i++) chars.push(pick(all));
  // Fisher-Yates shuffle so the required-class chars aren't always leading.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing bearer token" }, 401);
  }

  // Identify the caller from their JWT using the anon client.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const callerId = userData.user.id;

  // Authorize against the DATABASE: does the caller's role hold manage_users?
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: perms, error: permErr } = await admin
    .from("user_profiles")
    .select("role_id, roles!inner( role_permissions!inner( permissions!inner( slug ) ) )")
    .eq("id", callerId)
    .single();

  if (permErr) {
    return json({ error: "Could not verify permissions" }, 403);
  }
  const slugs: string[] = [];
  const roles = (perms as any)?.roles;
  const rolePerms = roles?.role_permissions ?? [];
  for (const rp of rolePerms) {
    const slug = rp?.permissions?.slug;
    if (slug) slugs.push(slug);
  }
  if (!slugs.includes("manage_users")) {
    return json({ error: "Forbidden: manage_users required" }, 403);
  }

  // Parse input.
  let body: { userId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const targetId = body.userId;
  if (!targetId) return json({ error: "userId is required" }, 400);

  // Use the admin-provided password if given, else generate one. Enforce a minimum.
  const tempPassword = body.password && body.password.length >= 10
    ? body.password
    : generateTempPassword();

  // Set the password with the admin API (service role).
  const { error: updErr } = await admin.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  });
  if (updErr) {
    return json({ error: `Could not set password: ${updErr.message}` }, 400);
  }

  // Force a change at first login. Never store the password itself.
  const { error: flagErr } = await admin
    .from("user_profiles")
    .update({ must_change_password: true })
    .eq("id", targetId);
  if (flagErr) {
    return json({ error: `Password set but flag not saved: ${flagErr.message}` }, 500);
  }

  // Return the temp password ONCE. It is not persisted anywhere readable.
  return json({ tempPassword });
});
