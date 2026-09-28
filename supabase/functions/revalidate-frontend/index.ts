/**
 * revalidate-frontend — Edge Function
 *
 * Holds the frontend revalidation token and calls the Next.js /api/revalidate
 * endpoint so a saved change is live immediately instead of waiting for ISR.
 *
 * WHO MAY CALL
 *  1. The CMS (browser). It sends the signed-in user's JWT, which is verified
 *     here and checked against the DATABASE permissions (roles ->
 *     role_permissions -> permissions). An allowed caller may revalidate any
 *     tag, any path, or everything.
 *  2. The Postgres trigger on exam_editions (via pg_net). A trigger cannot send
 *     a JWT, so an UNAUTHENTICATED request is accepted only for the narrow tag
 *     shapes that trigger uses (`exams` or `exam:<slug>`). Arbitrary paths are
 *     refused for it. That is the whole reason verify_jwt stays false.
 *
 * SECRETS
 *  - REVALIDATE_TOKEN is an Edge Function SECRET set by the owner
 *    (`supabase secrets set REVALIDATE_TOKEN=...`). It is read here with
 *    Deno.env.get and is the ONLY place the token exists server-side. It must
 *    equal the frontend's env.REVALIDATE_TOKEN. It is never stored in the
 *    `settings` table (the S0-1 follow-up removed that row), never sent to the
 *    browser and never present in the built CMS bundle.
 *    (History: the CMS once read VITE_REVALIDATE_TOKEN from its own .env, which
 *     Vite inlined into dist/ - every visitor had it; then it lived in the
 *     `settings` table, still one secret-management surface too many.)
 *  - The frontend base URL is read from settings (`frontend_url`) and is only
 *    accepted when it points at our own domain, so a stray value cannot ship
 *    the token to a third party.
 *
 * FAILURE: non-blocking for the trigger (always 200 there is a `softFail`
 * behaviour), explicit 4xx for a browser caller that is not allowed.
 *
 * Body:  { tag?: string, path?: string }   (empty body = revalidate critical paths)
 * Reply: { ok: boolean, ... }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// The revalidation secret lives ONLY here, as an Edge Function secret set by
// the owner. It mirrors the frontend's env.REVALIDATE_TOKEN. Never in the
// settings table, never in the browser bundle.
const REVALIDATE_TOKEN = Deno.env.get('REVALIDATE_TOKEN') ?? '';

/** Used when settings has no usable frontend_url. */
const FALLBACK_FRONTEND_URL = 'https://www.indianexaminfo.com';

/** Only our own site may receive the token. */
const ALLOWED_HOST_SUFFIX = 'indianexaminfo.com';

/** What an unauthenticated (trigger) caller may invalidate: ONE tag, never a
 *  path and never "everything". The trigger always sends a tag. */

/** Same set the CMS editor routes require. */
const REVALIDATE_PERMISSIONS = ['edit_any_post', 'create_exam', 'create_post', 'manage_settings'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Read a text setting, unwrapping the quotes a jsonb scalar carries. */
async function readSetting(admin: ReturnType<typeof createClient>, key: string): Promise<string> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  const raw = typeof data?.value === 'string' ? data.value : data?.value != null ? String(data.value) : '';
  return raw.replace(/^"|"$/g, '').trim();
}

/** Reject anything that is not http(s) on our own domain. */
function safeBaseUrl(candidate: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== ALLOWED_HOST_SUFFIX && !host.endsWith(`.${ALLOWED_HOST_SUFFIX}`)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Revalidation is not wired up on the server yet.' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const tag = typeof body.tag === 'string' && body.tag.trim() ? body.tag.trim() : '';
  let payloadTag = tag;
  const path = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : '';

  // ── Is this an authenticated CMS user? ─────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let authenticated = false;

  if (bearer) {
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json({ ok: false, error: 'Your session expired. Sign in again.' }, 401);

    const { data: profile } = await admin
      .from('user_profiles')
      .select('is_active, roles!inner( role_permissions!inner( permissions!inner( slug ) ) )')
      .eq('id', userData.user.id)
      .single();
    if (!profile || profile.is_active === false) {
      return json({ ok: false, error: 'This account cannot refresh the live site.' }, 403);
    }
    const held: string[] = [];
    for (const rp of ((profile as { roles?: { role_permissions?: unknown[] } })?.roles?.role_permissions ?? [])) {
      const slug = (rp as { permissions?: { slug?: string } })?.permissions?.slug;
      if (slug) held.push(slug);
    }
    if (!REVALIDATE_PERMISSIONS.some((p) => held.includes(p))) {
      return json({ ok: false, error: 'This account does not have permission to refresh the live site.' }, 403);
    }
    authenticated = true;
  } else {
    // No JWT: this is the Postgres trigger. It only ever revalidates one exam
    // tag, so anything broader (a path, or the "all critical paths" body) is
    // refused. This is the one place the anonymous surface is narrower than it
    // was before 28 Sep 2026.
    const examSlug = typeof body.exam_slug === 'string' ? body.exam_slug.trim() : '';
    if (!tag && examSlug) {
      // Older trigger shape: only a slug. Keep it working.
      payloadTag = `exam:${examSlug}`;
    } else if (!tag) {
      return json({ ok: false, error: 'Unauthenticated callers must name exactly one tag.' }, 403);
    }
  }

  // ── Token and target ───────────────────────────────────────────────────────
  const token = REVALIDATE_TOKEN;
  if (!token) {
    console.error('[revalidate-frontend] REVALIDATE_TOKEN secret is not set on the function');
    return json({ ok: false, error: 'Revalidation is not configured. The owner must set the REVALIDATE_TOKEN secret.' }, authenticated ? 500 : 200);
  }
  const configured = await readSetting(admin, 'frontend_url');
  const base = safeBaseUrl(configured) ?? safeBaseUrl(FALLBACK_FRONTEND_URL) ?? FALLBACK_FRONTEND_URL;

  const payload: Record<string, string> = {};
  if (payloadTag) payload.tag = payloadTag;
  else if (path && authenticated) payload.path = path;
  // neither → the frontend revalidates its critical paths (authenticated only,
  // because an unauthenticated caller was already rejected above for lacking a tag)

  const res = await fetch(`${base}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-token': token },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({}));
  console.log('[revalidate-frontend]', JSON.stringify({ payload, status: res.status, auth: authenticated }));

  return json(
    { ok: res.ok, status: res.status, ...(result as Record<string, unknown>) },
    // A trigger must not see a hard failure; a browser caller needs the real code.
    authenticated ? (res.ok ? 200 : 502) : 200,
  );
});
