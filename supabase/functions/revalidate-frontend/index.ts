/**
 * revalidate-frontend — Edge Function
 *
 * Called by the DB trigger on exam_editions when important_dates changes.
 * Reads the revalidate_token from the settings table, then calls the
 * Next.js /api/revalidate endpoint to bust the ISR cache for the affected exam.
 *
 * Auth: no JWT required (called from a Postgres trigger via pg_net, which
 * cannot send a Supabase auth token). The only secret in play is the
 * revalidate_token, which is read from the DB at call time and never exposed.
 *
 * Failure: non-blocking — logs the error but always returns 200 so the
 * DB trigger's EXCEPTION handler doesn't have to catch HTTP failures.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FRONTEND_URL = 'https://www.indianexaminfo.com';

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { tag, exam_slug } = body as { tag?: string; exam_slug?: string };

    // Use service role to read sensitive settings
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Read the revalidate token from settings
    const { data: setting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'revalidate_token')
      .single();

    if (error || !setting?.value) {
      console.error('[revalidate-frontend] Could not read revalidate_token:', error?.message);
      return new Response(JSON.stringify({ ok: false, error: 'no token' }), { status: 200 });
    }

    const token = String(setting.value).replace(/^"|"$/g, '').trim();

    // Prefer slug-level tag for targeted invalidation;
    // fall back to broad 'exams' if slug wasn't provided
    const revalidateTag = tag ?? (exam_slug ? `exam:${exam_slug}` : 'exams');

    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-token': token,
      },
      body: JSON.stringify({ tag: revalidateTag }),
    });

    const result = await res.json().catch(() => ({}));
    console.log(`[revalidate-frontend] tag=${revalidateTag} status=${res.status}`, result);

    return new Response(
      JSON.stringify({ ok: res.ok, tag: revalidateTag, status: res.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[revalidate-frontend] Unexpected error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 });
  }
});
