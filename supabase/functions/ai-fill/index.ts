// ai-fill — Edge Function
//
// The ONLY place a provider key is used. Until now the CMS SPA read the key out of
// the database and called the provider straight from the browser, which meant
// anyone with the (public) CMS login page could take the key and spend the quota.
// See docs/design/product-ux-investigation.md §3.7 and S0-1 of the 28 Sep brief.
//
// Guarantees
//  - The key never appears in a request from the browser, a response body, a log
//    line or the built CMS bundle. It is read from project secrets only.
//  - verify_jwt = true: the platform rejects an unauthenticated call before this
//    runs. The caller is then identified with their own JWT and authorised against
//    the DATABASE through public.current_user_has_permission() called WITH THE
//    CALLER'S OWN CLIENT (their JWT sets auth.uid() inside the SECURITY DEFINER
//    helper) - one rule, one place, no re-implemented join in this function.
//  - CORS is restricted to the CMS origins listed in the ALLOWED_ORIGINS secret
//    (comma-separated; include http://localhost:5177 for dev). Not "*".
//  - Input is capped, the provider call has a timeout, and the failure message is
//    plain words an intern can act on.
//  - Every call is recorded in ai_request_logs with the caller id, so the rate
//    limit holds across isolates and the quota has an audit trail. The log and
//    health-board writes are AWAITED before the response is returned - a
//    fire-and-forget promise can be dropped when the isolate freezes, and then
//    the rate limit counts nothing.
//
// SPRINT-1 NOTE (owner F2d, deliberately NOT built now): the browser still sends
// the whole prompt, so any user who passes the permission check can use this as
// a general model proxy inside the rate limits. In AI Fill v2 the prompt
// templates move server-side and the client sends { template, sourceText }.
//
// Secrets the OWNER sets (Dashboard -> Project Settings -> Edge Functions -> Secret
// keys, or `supabase secrets set --name AI_KEY_GROQ`):
//   AI_KEY_GROQ        required today (both configured providers are groq)
//   AI_KEY_GEMINI      only if a gemini provider row is enabled
//   AI_KEY_MISTRAL     only if a mistral provider row is enabled
//   AI_KEY_CEREBRAS    only if a cerebras provider row is enabled
//   AI_KEY_OPENROUTER  only if an openrouter provider row is enabled
//   AI_KEY_OPENAI      only if an openai provider row is enabled
//   AI_BASE_URL_<SLUG> optional override, e.g. AI_BASE_URL_GROQ
//   AI_MODEL           optional fallback model when no provider row is usable
//   ALLOWED_ORIGINS    comma-separated CMS origins, e.g.
//                      "https://cms.indianexaminfo.com,http://localhost:5177".
//                      Missing or empty => every browser cross-origin request is
//                      refused (fail closed).
// A provider row whose secret is missing is skipped, never guessed at.
//
// Body:  { prompt: string, consumer?: string, jsonMode?: boolean }
// 200:   { content: string, provider: string, model: string }
// Error: { error: string }  with 400/401/403/429/502/504
//
// jsonMode asks the provider for a single JSON object. The two browser callers
// this replaces did not behave the same way: the form auto-fill used temperature
// 0.05 and a JSON response type, the tab generators used 0.7 and plain text. Both
// shapes are kept - the caller says which one it is, so no behaviour moves here.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/**
 * F2c: the only browser origins allowed to call this function, from the
 * ALLOWED_ORIGINS secret (comma-separated; include http://localhost:5177 for
 * dev). Missing or empty => every browser cross-origin call is refused (fail
 * closed). An absent Origin header (curl, health probes) is not a browser and
 * passes; a PRESENT Origin that is not listed is refused.
 */
const ALLOWED_ORIGINS: string[] = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** The prompt cap. The largest real prompt here is a notification plus a schema. */
const MAX_INPUT_CHARS = 20_000;
/** Provider call budget. The browser used 30s; 25s leaves room to answer cleanly. */
const PROVIDER_TIMEOUT_MS = 25_000;
/** Per-user limits. AI Fill is a paste-and-check tool, not a chat. */
const MAX_CALLS_PER_5_MIN = 15;
const MAX_CALLS_PER_DAY = 150;

/** Permissions that unlock AI Fill - checked via current_user_has_permission(). */
const REQUIRED_PERMISSIONS = ["edit_any_post", "create_exam", "create_post"];

/** provider slug in ai_providers -> name of the secret that holds its key */
const SECRET_BY_PROVIDER: Record<string, string> = {
  groq: "AI_KEY_GROQ",
  openai: "AI_KEY_OPENAI",
  mistral: "AI_KEY_MISTRAL",
  cerebras: "AI_KEY_CEREBRAS",
  openrouter: "AI_KEY_OPENROUTER",
  gemini: "AI_KEY_GEMINI",
};

/**
 * Where each provider is called. Only the slugs AIProviderManager can save are
 * listed; an unknown slug has no secret and no URL, so its row is skipped.
 * Override with AI_BASE_URL_<SLUG> (e.g. a proxy or a region endpoint).
 */
const BASE_URL_BY_PROVIDER: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  mistral: "https://api.mistral.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com",
};

function baseUrlFor(slug: string): string {
  const override = Deno.env.get(`AI_BASE_URL_${slug.toUpperCase()}`);
  const base = (override || BASE_URL_BY_PROVIDER[slug] || "").replace(/\/+$/, "");
  return base;
}

/**
 * F2c: CORS is NOT "*". The origin is checked per request against
 * ALLOWED_ORIGINS; a disallowed browser origin gets no
 * Access-Control-Allow-Origin header at all (the browser then blocks the call)
 * and OPTIONS preflights from it are refused outright.
 */
function corsFor(req: Request): { headers: Record<string, string>; allowed: boolean } {
  const origin = req.headers.get("Origin");
  const allowed = origin === null || origin === "" || ALLOWED_ORIGINS.includes(origin);
  return {
    allowed,
    headers: {
      ...(allowed && origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Short, non-reversible prompt fingerprint for the log (never the text). */
async function promptHash(prompt: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(prompt));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  } catch {
    return "unavailable";
  }
}

type Resolved = {
  kind: "openai-compatible" | "gemini";
  provider: string;
  model: string;
  key: string;
  baseUrl: string;
  providerId: string | null;
};

/**
 * Build the call list: enabled ai_providers rows in priority order, each paired
 * with its secret. A row whose provider has no secret is skipped - it cannot be
 * called. If nothing resolves, fall back to AI_KEY_GROQ / AI_MODEL so a single
 * secret is enough to get running.
 */
async function resolveProviders(admin: ReturnType<typeof createClient>): Promise<Resolved[]> {
  const out: Resolved[] = [];
  const { data: rows } = await admin
    .from("ai_providers")
    .select("id, provider, model, priority")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  for (const row of rows ?? []) {
    const slug = String(row.provider ?? "").toLowerCase();
    const secretName = SECRET_BY_PROVIDER[slug];
    const key = secretName ? Deno.env.get(secretName) : undefined;
    const baseUrl = baseUrlFor(slug);
    // No secret or no endpoint for this provider - it cannot be called, so it is
    // skipped rather than tried and failed.
    if (!key || !baseUrl) continue;
    out.push({
      kind: slug === "gemini" ? "gemini" : "openai-compatible",
      provider: slug,
      model: String(row.model),
      key,
      baseUrl,
      providerId: String(row.id),
    });
  }

  // Nothing usable in the table: one secret (AI_KEY_GROQ or AI_KEY_OPENAI) is
  // enough to get running, so a fresh deployment without provider rows still works.
  if (out.length === 0) {
    const fallbackSlug = Deno.env.get("AI_KEY_GROQ") ? "groq" : "openai";
    const key = Deno.env.get(SECRET_BY_PROVIDER[fallbackSlug] ?? "");
    const baseUrl = baseUrlFor(fallbackSlug);
    const model = Deno.env.get("AI_MODEL") ?? "openai/gpt-oss-120b";
    if (key && baseUrl) {
      out.push({
        kind: "openai-compatible",
        provider: fallbackSlug,
        model,
        key,
        baseUrl,
        providerId: null,
      });
    }
  }
  return out;
}

/** One provider attempt. Throws Error with a plain message; never includes the key. */
async function callOne(target: Resolved, prompt: string, jsonMode: boolean, signal: AbortSignal): Promise<string> {
  if (target.kind === "gemini") {
    const url = `${target.baseUrl}/v1beta/models/${encodeURIComponent(target.model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": target.key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: jsonMode ? 0.05 : 0.7,
          maxOutputTokens: jsonMode ? 8192 : 4096,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`${target.provider} returned ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";
    if (!text.trim()) throw new Error(`${target.provider} returned no text`);
    return text;
  }

  const res = await fetch(`${target.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    // Mirrors the parameters the browser used, so extraction quality does not move
    // underneath the review screen at the same time as the transport changes.
    body: JSON.stringify({
      model: target.model,
      messages: [{ role: "user", content: prompt }],
      temperature: jsonMode ? 0.05 : 0.7,
      max_tokens: jsonMode ? 8192 : 4096,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${target.provider} returned ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!String(text).trim()) throw new Error(`${target.provider} returned no text`);
  return String(text);
}

Deno.serve(async (req) => {
  // F2c: origin gate first — a browser on a foreign origin gets nothing.
  const cors = corsFor(req);
  if (!cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors.headers);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "AI is not wired up on the server yet." }, 500, cors.headers);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in to the CMS first." }, 401, cors.headers);

  // 1. Who is calling?
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Your session expired. Sign in again." }, 401, cors.headers);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_active")
    .eq("id", userId)
    .single();
  if (profile?.is_active === false) return json({ error: "This account is disabled." }, 403, cors.headers);

  // 2. Are they allowed to edit content? One rule, one place: the SAME database
  // helper the RLS policies use, called on the CALLER's client so their JWT sets
  // auth.uid() inside it (SECURITY DEFINER). No re-implemented join here.
  let held = false;
  for (const perm of REQUIRED_PERMISSIONS) {
    const { data, error } = await caller.rpc("current_user_has_permission", { perm_slug: perm });
    if (error) {
      return json({ error: "Could not check your permissions. Try again." }, 403, cors.headers);
    }
    if (data === true) { held = true; break; }
  }
  if (!held) {
    return json({ error: "AI Fill needs content-editing rights, which this account does not have." }, 403, cors.headers);
  }

  // 3. Rate limit per user, counted in the database so it survives new isolates.
  const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [{ count: recent }, { count: today }] = await Promise.all([
    admin.from("ai_request_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since5),
    admin.from("ai_request_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", sinceDay),
  ]);
  if ((recent ?? 0) >= MAX_CALLS_PER_5_MIN) {
    return json({ error: "Too many AI requests in the last few minutes. Wait a moment and try again." }, 429, cors.headers);
  }
  if ((today ?? 0) >= MAX_CALLS_PER_DAY) {
    return json({ error: "This account has used its AI allowance for today. Ask the admin if you need more." }, 429, cors.headers);
  }

  // 4. Input cap.
  let body: { prompt?: unknown; consumer?: unknown; jsonMode?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request was not valid JSON." }, 400, cors.headers);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return json({ error: "There was nothing to send. Paste the notification text first." }, 400, cors.headers);
  if (prompt.length > MAX_INPUT_CHARS) {
    return json({ error: `That text is too long for AI Fill (${prompt.length} characters, limit ${MAX_INPUT_CHARS}). Shorten it to the parts that matter.` }, 400, cors.headers);
  }
  const consumer = typeof body.consumer === "string" && body.consumer.trim() ? body.consumer.slice(0, 60) : "ai-fill";
  const jsonMode = body.jsonMode === true;

  // 5. Call the provider, walking enabled rows in priority order.
  const targets = await resolveProviders(admin);
  if (targets.length === 0) {
    return json({ error: "AI is not configured on the server yet. The admin must set the AI_KEY_GROQ secret." }, 500, cors.headers);
  }

  const hash = await promptHash(prompt);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let lastMessage = "AI could not read that text.";

  try {
    for (const target of targets) {
      const attemptStart = Date.now();
      try {
        const content = await callOne(target, prompt, jsonMode, controller.signal);
        const latency = Date.now() - started;
        clearTimeout(timer);
        // F2a: AWAITED, not fire-and-forget — if the isolate is frozen after the
        // response, an un-awaited promise never lands and the rate limit would
        // count nothing.
        await admin.from("ai_request_logs").insert({
          provider_id: target.providerId, user_id: userId, prompt_hash: hash,
          status: "success", error_message: null, latency_ms: latency, consumer_name: consumer,
        });
        // Health board: only when the call came from a real provider row.
        if (target.providerId) {
          await admin.from("ai_providers")
            .update({ last_used_at: new Date().toISOString(), last_error: null })
            .eq("id", target.providerId);
        }
        return json({ content, provider: target.provider, model: target.model }, 200, cors.headers);
      } catch (err) {
        const aborted = controller.signal.aborted;
        lastMessage = aborted ? "timed out" : (err instanceof Error ? err.message : String(err));
        if (aborted) clearTimeout(timer); // do not let the abort kill the DB writes below
        await admin.from("ai_request_logs").insert({
          provider_id: target.providerId, user_id: userId, prompt_hash: hash,
          status: "error", error_message: lastMessage.slice(0, 500),
          latency_ms: Date.now() - attemptStart, consumer_name: consumer,
        });
        if (target.providerId) {
          await admin.from("ai_providers").update({ last_error: lastMessage.slice(0, 500) }).eq("id", target.providerId);
        }
        if (aborted) break; // no point trying the next provider with no time left
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (lastMessage === "timed out") {
    return json({ error: "AI took too long to answer and the request was stopped. Your typing is safe - try again, or fill the fields yourself." }, 504, cors.headers);
  }
  return json({ error: `AI could not complete the request (${lastMessage}). Nothing was saved.` }, 502, cors.headers);
});
