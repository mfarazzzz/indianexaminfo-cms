/**
 * submit-message — Edge Function (Sprint 0 Part 2, owner correction a)
 *
 * THE ONE WRITE PATH for reader messages (contact form + report-error sheet).
 * verify_jwt is OFF (deploy with --no-verify-jwt) because readers are not
 * logged in — so every protection lives here, and the database gives anon
 * NOTHING (no RPC, no insert, no select; see supabase/proposed/
 * reader_messages.sql). This function inserts with the SERVICE ROLE; the raw
 * IP is hashed and never stored.
 *
 * WHAT IT DOES, IN ORDER
 *  1. shape + enum validation, length caps (message 10..2000; contact fields
 *     bounded; page_url must be http(s) on our own domain or it is dropped)
 *  2. contact rules per source: contact_form needs email-or-phone + consent;
 *     report_sheet keeps the barrier low (contact optional, per A.2)
 *  3. honeypot: hidden field `website` must stay empty — a filled honeypot
 *     gets a FAKE success (200 + a ref that resolves to nothing) so the bot
 *     learns nothing, and nothing is written
 *  4. minimum fill-time: `filled_ms` (ms since the form rendered) must be >=
 *     MIN_FILL_MS; below that it is a bot or a paste-blast → rejected
 *  5. rate limit PER SALTED IP HASH for BOTH sources: sha256(SALT|ip) fed to
 *     the message_rate_limit_attempt RPC — 5 per 10 minutes by default
 *  6. resolve page_url → (entity_type, entity_id): last path segments looked
 *     up in exams → content_posts → blog_posts slugs; best-effort, NULL when
 *     nothing matches (the raw page_url is always stored)
 *  7. insert with the service role; human ref IEI-XXXXX minted from the row
 *     uuid; on the (vanishingly rare) UNIQUE clash, retry with a fresh uuid
 *
 * SECRETS (owner sets; never in the browser, never in the settings table)
 *  - MESSAGE_RATE_LIMIT_SALT: the pepper for the IP hash. If missing the
 *    function FAILS CLOSED (500) rather than accept unthrottled traffic.
 *  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: provided by the runtime.
 *
 * Body (JSON): { source, category, message, reason?, name?, email?, phone?,
 *                page_url?, page_title?, consent, website?, filled_ms? }
 * Reply: success { ok: true, ref } | failure { ok: false, error }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RATE_SALT = Deno.env.get('MESSAGE_RATE_LIMIT_SALT') ?? '';

const MAX_BODY_BYTES = 16_384;          // a real submission is ~1 KB
const MIN_FILL_MS = 2_000;              // humans take longer to write 10 chars
const RATE_MAX_HITS = 5;                // per bucket…
const RATE_WINDOW_MINUTES = 10;         // …per this window (both sources)
const ALLOWED_HOST_SUFFIX = 'indianexaminfo.com';

const SOURCES = ['contact_form', 'report_sheet'];
const CATEGORIES = [
  'report_error', 'suggest_update', 'general_question',
  'technical_problem', 'advertising', 'legal_removal',
];
const REASONS = ['wrong_last_date', 'broken_link', 'wrong_eligibility', 'missing_result', 'other'];

/**
 * ONE shared phone rule, kept byte-for-byte in lock-step with the frontend
 * (indianexaminfo-frontend lib/contact/submitMessage.ts). Indian mobile: 10
 * digits starting 6-9 with an optional +91 / 91 / 0 prefix; separators (spaces,
 * dashes, dots, brackets) are stripped before the test. Stricter than the old
 * /^\+?9?1?[6-9][0-9]{9}$/, which read a leading "9" as a country code and so
 * wrongly accepted 11-digit numbers such as 98765432101.
 */
const PHONE_RE = /^(?:\+91|91|0)?[6-9]\d{9}$/;
function stripPhoneSeparators(v: string): string {
  return v.trim().replace(/[\s\-().\[\]]/g, '');
}
/** +91 followed by the 10-digit national number, or null when invalid. */
function canonicalizePhone(v: string): string | null {
  const s = stripPhoneSeparators(v);
  if (!PHONE_RE.test(s)) return null;
  return `+91${s.replace(/\D/g, '').slice(-10)}`;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** sha256 hex of SALT|ip — the ONLY thing ever stored for the client address. */
async function saltedIpHash(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${RATE_SALT}|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Best-effort page_url → entity. Own-domain URLs only; slugs tried right→left. */
async function resolveEntity(
  admin: ReturnType<typeof createClient>,
  pageUrl: string,
): Promise<{ type: 'exam' | 'content_post' | 'blog_post'; id: string } | null> {
  let path = '';
  try {
    const u = new URL(pageUrl);
    path = u.pathname;
  } catch {
    return null;
  }
  const segs = path.split('/').filter(Boolean).slice(-3).reverse();
  for (const slug of segs) {
    if (slug.length > 160) continue;
    const exam = await admin.from('exams').select('id').eq('slug', slug).maybeSingle();
    if (exam.data) return { type: 'exam', id: exam.data.id };
    const post = await admin.from('content_posts').select('id').eq('slug', slug).maybeSingle();
    if (post.data) return { type: 'content_post', id: post.data.id };
    const blog = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (blog.data) return { type: 'blog_post', id: blog.data.id };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Messages are not wired up on the server yet.' }, 500);
  }
  // Fail CLOSED: no salt means no trustworthy rate limiting — refuse service.
  if (!RATE_SALT) {
    console.error('[submit-message] MESSAGE_RATE_LIMIT_SALT secret is not set');
    return json({ ok: false, error: 'The message service is misconfigured.' }, 500);
  }

  // Bounded body — never hand a parser an unbounded stream.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Submission too large.' }, 413);
  const body: Record<string, unknown> = (() => {
    try { return JSON.parse(raw); } catch { return {}; }
  })();

  const source = str(body.source);
  const category = str(body.category);
  const message = str(body.message);
  const reason = str(body.reason) || null;
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const pageTitle = str(body.page_title);
  const consent = body.consent === true;
  const honeypot = str(body.website);
  const filledMs = typeof body.filled_ms === 'number' ? body.filled_ms : -1;

  // 3. Honeypot first: a filled hidden field is a bot — fake success, write nothing.
  if (honeypot !== '') {
    const fake = crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
    return json({ ok: true, ref: `IEI-${fake}` }, 200);
  }

  // 4. Minimum fill-time (both sources).
  if (filledMs < MIN_FILL_MS) {
    return json({ ok: false, error: 'Please complete the form and try again.' }, 400);
  }

  // 1. Shape, enums and length caps.
  if (!SOURCES.includes(source)) return json({ ok: false, error: 'Invalid submission source.' }, 400);
  if (!CATEGORIES.includes(category)) return json({ ok: false, error: 'Invalid category.' }, 400);
  if (reason !== null && !REASONS.includes(reason)) return json({ ok: false, error: 'Invalid reason.' }, 400);
  if (message.length < 10 || message.length > 2000) {
    return json({ ok: false, error: 'Message must be 10-2000 characters.' }, 400);
  }
  if (name.length > 120) return json({ ok: false, error: 'Name too long.' }, 400);
  if (email.length > 254) return json({ ok: false, error: 'Email too long.' }, 400);
  if (phone.length > 20) return json({ ok: false, error: 'Phone too long.' }, 400);
  if (pageTitle.length > 300) return json({ ok: false, error: 'Title too long.' }, 400);

  // page_url: http(s) on OUR domain, or dropped (never a redirect oracle).
  let pageUrl: string | null = null;
  const rawUrl = str(body.page_url);
  if (rawUrl) {
    if (rawUrl.length > 500) return json({ ok: false, error: 'Page address too long.' }, 400);
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      if ((u.protocol === 'https:' || u.protocol === 'http:')
          && (host === ALLOWED_HOST_SUFFIX || host.endsWith(`.${ALLOWED_HOST_SUFFIX}`))) {
        pageUrl = u.toString();
      } // foreign or odd-scheme URLs are silently dropped; the message still lands
    } catch { /* drop */ }
  }

  // 2. Per-source contact rules.
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: 'That email address does not look right.' }, 400);
  }
  if (phone && !canonicalizePhone(phone)) {
    return json({ ok: false, error: 'That phone number does not look right.' }, 400);
  }
  if (source === 'contact_form') {
    if (!email && !phone) {
      return json({ ok: false, error: 'Please give an email or phone so we can reply.' }, 400);
    }
    if (!consent) {
      return json({ ok: false, error: 'Please accept the privacy notice.' }, 400);
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 5. Rate limit per salted IP hash — BOTH sources, 5 per 10 minutes.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
          || (req.headers.get('x-real-ip') ?? '').trim()
          || (req.headers.get('cf-connecting-ip') ?? '').trim()
          || 'unknown';
  const bucketKey = await saltedIpHash(ip);
  const { data: allowed, error: rlErr } = await admin.rpc('message_rate_limit_attempt', {
    p_bucket_key: bucketKey,
    p_max_hits: RATE_MAX_HITS,
    p_window_minutes: RATE_WINDOW_MINUTES,
  });
  if (rlErr) {
    console.error('[submit-message] rate limit RPC failed', rlErr.message);
    return json({ ok: false, error: 'The message service is busy. Try again shortly.' }, 503);
  }
  if (allowed !== true) {
    return json({ ok: false, error: 'Too many messages from your connection. Please try again in a few minutes.' }, 429);
  }

  // 6. page_url → (entity_type, entity_id), best effort.
  const entity = pageUrl ? await resolveEntity(admin, pageUrl) : null;

  // 7. Insert with the service role. Ref from the row uuid; UNIQUE(ref_number)
  // is the guard, with a small retry for the astronomical clash.
  const row = {
    source,
    category,
    reason,
    message,
    sender_name: name || null,
    sender_email: email || null,
    sender_phone: phone ? canonicalizePhone(phone) : null,
    page_url: pageUrl,
    page_title: pageTitle || null,
    entity_type: entity?.type ?? null,
    entity_id: entity?.id ?? null,
    consent: source === 'contact_form' ? true : consent,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = crypto.randomUUID();
    const ref = `IEI-${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
    const { error } = await admin.from('reader_messages').insert({ id, ref_number: ref, ...row });
    if (!error) return json({ ok: true, ref }, 200);
    if (error.code !== '23505') { // unique_violation → retry with a fresh code
      console.error('[submit-message] insert failed', error.message);
      return json({ ok: false, error: 'Could not save your message. Please try again.' }, 500);
    }
  }
  return json({ ok: false, error: 'Could not save your message. Please try again.' }, 500);
});
