/**
 * revalidate-frontend — Edge Function
 *
 * Holds the frontend revalidation token and calls the Next.js /api/revalidate
 * endpoint so a saved change is live immediately instead of waiting for ISR.
 *
 * NO UNAUTHENTICATED PATH (owner A3, 28 Sep). Every request must carry ONE of:
 *  1. A CMS user's JWT. It is verified here and the caller is authorised against
 *     the DATABASE through public.current_user_has_permission() called on the
 *     CALLER'S OWN client (their JWT sets auth.uid() inside the SECURITY DEFINER
 *     helper) - one rule, one place, no re-implemented join. An allowed CMS
 *     caller may revalidate any tag, any path, or everything.
 *  2. The `x-trigger-secret` header sent by the Postgres trigger on exam_editions
 *     (via pg_net). A trigger cannot send a JWT, so it authenticates with a
 *     shared secret instead: the trigger reads it from Supabase Vault and the
 *     function compares it, IN CONSTANT TIME, with its own env secret
 *     TRIGGER_SHARED_SECRET. A trigger caller may revalidate only ONE exam tag
 *     (`exam:<slug>` or `exams`) - never a path, never "everything".
 * Anything else is refused with 401. verify_jwt is OFF only because path 2 has
 * no JWT; the function enforces authentication itself.
 *
 * DEBOUNCE (owner A3 review, 30 Sep): ONLY the trigger path is debounced, one
 * tag at most once per 10 s - it exists purely to drop the trigger's duplicate
 * of a CMS call. A CMS (JWT) call is NEVER debounced: an editor who saves twice
 * within the window must get both refreshes. Checked in the DATABASE
 * (public.revalidate_should_fire), not in an in-memory map, because edge
 * isolates do not share memory and a fresh isolate would let a burst through.
 * A debounced call is a NO-OP that returns { ok: true, debounced: true } - the
 * cache is still fresh, nothing to do.
 *
 * SECRETS (all Edge Function secrets set by the owner; never in settings, never
 * in the browser, never in the built CMS bundle):
 *  - REVALIDATE_TOKEN      mirrors the frontend's env.REVALIDATE_TOKEN; the only
 *                          server-side copy of the cache-busting token.
 *  - TRIGGER_SHARED_SECRET must equal the Vault secret `revalidate_trigger_secret`
 *                          that the trigger sends in the x-trigger-secret header.
 *  - ALLOWED_ORIGINS       comma-separated CMS origins (same list ai-fill uses,
 *                          e.g. "https://admincms1.indianexaminfo.com,http://localhost:5177").
 *                          CORS is NOT "*"; missing or empty => every browser
 *                          cross-origin request is refused (fail closed). The
 *                          trigger sends no Origin header and is unaffected.
 *  - The frontend base URL is read from settings (`frontend_url`) and is only
 *    accepted when it points at our own domain, so a stray value cannot ship
 *    the token to a third party.
 *
 * FAILURE: never a hard failure for the trigger (soft 200); explicit 4xx for a
 * browser caller that is not authenticated or not allowed.
 *
 * Body:  { tag?: string, path?: string, exam_slug?: string }  (empty = critical paths, CMS only)
 * Reply: { ok: boolean, ... }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// The revalidation token lives ONLY here, as an Edge Function secret. Never in
// the settings table, never in the browser bundle.
const REVALIDATE_TOKEN = Deno.env.get('REVALIDATE_TOKEN') ?? '';
// Compared (constant time) with the x-trigger-secret header from the pg_net
// trigger. Must equal the Vault secret `revalidate_trigger_secret`.
const TRIGGER_SHARED_SECRET = Deno.env.get('TRIGGER_SHARED_SECRET') ?? '';
// A3 review (30 Sep): the only browser origins allowed to call this function,
// from the ALLOWED_ORIGINS secret - the same allow-list ai-fill uses, not "*".
// Missing or empty => every browser cross-origin call is refused (fail closed).
// The pg_net trigger sends no Origin header, so the trigger path is unaffected.
const ALLOWED_ORIGINS: string[] = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Used when settings has no usable frontend_url. */
const FALLBACK_FRONTEND_URL = 'https://www.indianexaminfo.com';
/** Only our own site may receive the token. */
const ALLOWED_HOST_SUFFIX = 'indianexaminfo.com';
/** The header the Postgres trigger authenticates with. */
const TRIGGER_SECRET_HEADER = 'x-trigger-secret';
/** Trigger-path debounce: same tag at most once per this many seconds. */
const REVALIDATE_DEBOUNCE_WINDOW = 10;

/** Same set the CMS editor routes require. */
const REVALIDATE_PERMISSIONS = ['edit_any_post', 'create_exam', 'create_post', 'manage_settings'];

/**
 * A3 review (30 Sep): CORS is NOT "*". The origin is checked per request
 * against ALLOWED_ORIGINS (the same rule ai-fill uses). An absent Origin
 * header (the pg_net trigger, curl, health probes) is not a browser and
 * passes; a PRESENT Origin that is not listed gets no
 * Access-Control-Allow-Origin header and OPTIONS preflights from it are
 * refused outright (403).
 */
function corsFor(req: Request): { headers: Record<string, string>; allowed: boolean } {
  const origin = req.headers.get('Origin');
  const allowed = origin === null || origin === '' || ALLOWED_ORIGINS.includes(origin);
  return {
    allowed,
    headers: {
      ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  };
}

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Constant-time string comparison. Both sides are hashed with SHA-256 first so
 * the operands are always the same length and neither their length nor a
 * matching prefix leaks through an early return; the digests are then compared
 * byte by byte without short-circuiting.
 */
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ba = new Uint8Array(da);
  const bb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
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
  const { headers: corsHeaders, allowed: originAllowed } = corsFor(req);
  const reply = (body: unknown, status = 200) => json(body, status, corsHeaders);

  if (req.method === 'OPTIONS') {
    return originAllowed
      ? new Response('ok', { headers: corsHeaders })
      : reply({ ok: false, error: 'Origin not allowed' }, 403);
  }
  // A3 review: foreign browser origin is refused before anything else. The
  // trigger sends no Origin, so it is not affected.
  if (!originAllowed) return reply({ ok: false, error: 'Origin not allowed' }, 403);
  if (req.method !== 'POST') return reply({ ok: false, error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply({ ok: false, error: 'Revalidation is not wired up on the server yet.' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const tag = typeof body.tag === 'string' && body.tag.trim() ? body.tag.trim() : '';
  let payloadTag = tag;
  const path = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : '';

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const triggerHeader = (req.headers.get(TRIGGER_SECRET_HEADER) ?? '').trim();

  let caller: 'cms' | 'trigger' | null = null;

  if (bearer) {
    // ── Path 1: a signed-in CMS user ──────────────────────────────────────────
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return reply({ ok: false, error: 'Your session expired. Sign in again.' }, 401);

    const { data: profile } = await admin
      .from('user_profiles')
      .select('is_active')
      .eq('id', userData.user.id)
      .single();
    if (!profile || profile.is_active === false) {
      return reply({ ok: false, error: 'This account cannot refresh the live site.' }, 403);
    }

    // One rule, one place: the SAME database helper the RLS policies use, on the
    // caller's own client so their JWT sets auth.uid() inside it.
    let allowed = false;
    for (const perm of REVALIDATE_PERMISSIONS) {
      const { data, error } = await userClient.rpc('current_user_has_permission', { perm_slug: perm });
      if (error) {
        return reply({ ok: false, error: 'Could not check your permissions. Try again.' }, 403);
      }
      if (data === true) { allowed = true; break; }
    }
    if (!allowed) {
      return reply({ ok: false, error: 'This account does not have permission to refresh the live site.' }, 403);
    }
    caller = 'cms';
  } else if (triggerHeader !== '') {
    // ── Path 2: the Postgres trigger, authenticated by the shared secret ──────
    if (!TRIGGER_SHARED_SECRET) {
      console.error('[revalidate-frontend] TRIGGER_SHARED_SECRET secret is not set on the function');
      // A trigger must not see a hard failure; 500 only reports our own misconfig.
      return reply({ ok: false, error: 'Trigger revalidation is not configured.' }, 500);
    }
    if (!(await constantTimeEqual(triggerHeader, TRIGGER_SHARED_SECRET))) {
      return reply({ ok: false, error: 'Invalid trigger secret.' }, 401);
    }
    // Narrow surface: exactly one exam tag, never a path, never "everything".
    const examSlug = typeof body.exam_slug === 'string' ? body.exam_slug.trim() : '';
    if (!payloadTag && examSlug) payloadTag = `exam:${examSlug}`;
    if (!payloadTag || path) {
      return reply({ ok: false, error: 'The trigger may only name exactly one tag.' }, 403);
    }
    caller = 'trigger';
  } else {
    // ── No JWT and no trigger secret: there is NO unauthenticated path. ───────
    return reply({ ok: false, error: 'A valid CMS session or the trigger secret is required.' }, 401);
  }

  // ── Debounce: TRIGGER PATH ONLY, one tag at most once per 10 s (DB, not
  //    memory). A3 review (30 Sep): a CMS call is NEVER debounced - an editor
  //    who saves twice within the window must get both refreshes. ─────────────
  if (caller === 'trigger' && payloadTag) {
    const { data: shouldFire, error: debErr } = await admin.rpc('revalidate_should_fire', {
      p_tag: payloadTag,
      p_window_seconds: REVALIDATE_DEBOUNCE_WINDOW,
    });
    if (!debErr && shouldFire === false) {
      // Fresh within the window: nothing to do, the cache is still fresh; this
      // only drops the trigger's duplicate of a CMS revalidation.
      return reply({ ok: true, debounced: true, tag: payloadTag }, 200);
    }
    if (debErr) {
      // Debounce is an optimisation, not a security control — fail OPEN (do the
      // revalidation) rather than skip a legitimate refresh.
      console.error('[revalidate-frontend] debounce check failed', debErr.message);
    }
  }

  // ── Token and target ───────────────────────────────────────────────────────
  const token = REVALIDATE_TOKEN;
  if (!token) {
    console.error('[revalidate-frontend] REVALIDATE_TOKEN secret is not set on the function');
    return reply({ ok: false, error: 'Revalidation is not configured. The owner must set the REVALIDATE_TOKEN secret.' }, caller === 'cms' ? 500 : 200);
  }
  const configured = await readSetting(admin, 'frontend_url');
  const base = safeBaseUrl(configured) ?? safeBaseUrl(FALLBACK_FRONTEND_URL) ?? FALLBACK_FRONTEND_URL;

  const payload: Record<string, string> = {};
  if (payloadTag) payload.tag = payloadTag;
  else if (path && caller === 'cms') payload.path = path;
  // neither → the frontend revalidates its critical paths (CMS callers only; a
  // trigger caller was already rejected above for lacking a tag)

  const res = await fetch(`${base}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-token': token },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({}));
  console.log('[revalidate-frontend]', JSON.stringify({ payload, status: res.status, caller }));

  return reply(
    { ok: res.ok, status: res.status, ...(result as Record<string, unknown>) },
    // A trigger must not see a hard failure; a browser caller needs the real code.
    caller === 'cms' ? (res.ok ? 200 : 502) : 200,
  );
});
