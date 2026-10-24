/**
 * social-publish — Edge Function (S7.1b). The ONLY thing that talks to Telegram.
 * Evaluated in ONE place, in order: kill_switch → dry_run → claim → daily cap →
 * sendMessage → redacted log. Service-role; called by the CMS "Run due queue" button.
 *
 * Env (owner-set): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TG_BOT_TOKEN.
 * Deployed WITH verify_jwt (default): the browser "Run due queue" button calls this
 * with the signed-in user's JWT; the function then uses its OWN service-role key (from
 * env) for the privileged writes (claim + status='sent', which the staff trigger blocks).
 * TG_BOT_TOKEN is read once, used only in the Authorization header, and NEVER put in
 * a payload, a caption, or a log line (redactError guards the error path).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { capExceeded, redactError, telegramPayload } from "../_shared/social.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TG_BOT_TOKEN = Deno.env.get("TG_BOT_TOKEN") ?? "";

Deno.serve(async (req) => {
  // verify_jwt is ON; also require a user bearer token so an unauthenticated call fails.
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || !SERVICE_KEY) return json({ ok: false, error: "unauthorized" }, 401);
  let body: { limit?: number; channel?: string };
  try { body = await req.json(); } catch { body = {}; }
  const channel = body.channel ?? "telegram";
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: cfg } = await supabase.from("social_config").select("kill_switch, dry_run, telegram_daily_cap").eq("id", 1).single();
  if (cfg?.kill_switch) return json({ ok: true, killed: true, sent: 0 });   // ship OFF → nothing happens

  // Atomic claim (FOR UPDATE SKIP LOCKED) → two clicks cannot double-post.
  const { data: claimed, error: claimErr } = await supabase.rpc("claim_due_social_posts", { p_limit: limit, p_channel: channel });
  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  const rows = (claimed ?? []) as Array<{ id: string; caption: string; landing_url: string; channel_id: string | null }>;
  if (rows.length === 0) return json({ ok: true, sent: 0, dry_run: !!cfg?.dry_run });

  const { data: chat } = await supabase.from("social_channels").select("external_id").eq("channel", channel).eq("is_active", true).limit(1).maybeSingle();
  const { data: sentToday } = await supabase.rpc("social_sent_today", { p_channel: channel });
  const cap = cfg?.telegram_daily_cap ?? 20;

  const results: Array<{ id: string; status: string }> = [];
  for (const row of rows) {
    if (cfg?.dry_run) {
      // DRY RUN: write the EXACT payload to the log, post nothing, return the row to 'approved'.
      await supabase.from("social_publish_log").insert({ post_id: row.id, channel, status: "skipped", provider_code: "dry_run", error_message: null });
      await supabase.from("social_posts").update({ status: "approved" }).eq("id", row.id);
      results.push({ id: row.id, status: "dry_run" });
      continue;
    }
    if (capExceeded(sentToday ?? 0, cap)) {
      await supabase.from("social_posts").update({ status: "approved" }).eq("id", row.id);
      results.push({ id: row.id, status: "cap_reached" });
      continue;
    }
    if (!TG_BOT_TOKEN || !chat?.external_id) {
      await supabase.from("social_posts").update({ status: "failed", error: "missing TG_BOT_TOKEN or chat id" }).eq("id", row.id);
      results.push({ id: row.id, status: "config_missing" });
      continue;
    }
    const payload = telegramPayload(chat.external_id, row.caption);
    const t0 = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      const latency = Date.now() - t0;
      if (res.ok && j?.ok) {
        await supabase.from("social_posts").update({ status: "sent", external_id: String(j?.result?.message_id ?? "") }).eq("id", row.id);
        await supabase.from("social_publish_log").insert({ post_id: row.id, channel, status: "success", latency_ms: latency });
        results.push({ id: row.id, status: "sent" });
      } else {
        await supabase.from("social_posts").update({ status: "failed", error: redactError(JSON.stringify(j), TG_BOT_TOKEN) }).eq("id", row.id);
        await supabase.from("social_publish_log").insert({ post_id: row.id, channel, status: "error", provider_code: String(res.status), error_message: redactError(JSON.stringify(j), TG_BOT_TOKEN), latency_ms: latency });
        results.push({ id: row.id, status: "failed" });
      }
    } catch (e) {
      await supabase.from("social_posts").update({ status: "failed", error: redactError(String(e), TG_BOT_TOKEN) }).eq("id", row.id);
      await supabase.from("social_publish_log").insert({ post_id: row.id, channel, status: "error", error_message: redactError(String(e), TG_BOT_TOKEN) });
      results.push({ id: row.id, status: "error" });
    }
  }
  return json({ ok: true, dry_run: !!cfg?.dry_run, results });
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
