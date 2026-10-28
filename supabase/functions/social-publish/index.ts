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
import {
  isTestSlug, landingUrlIsTest, queueHeadroom, redactError, telegramPayload,
} from "../_shared/social.ts";

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

  // J2-4 — the BATCH SIZE THE WORKER PASSES is cap - sent_today - currently_queued, never
  // negative, and it is computed BEFORE the claim: a claim marks rows 'queued', so claiming
  // ten rows when three remain under the cap would park seven in 'queued' and spend capacity
  // that does not exist. A row already 'queued' counts as spent, because it may be mid-send in
  // another request; counting only 'sent' would let successive clicks overrun the day.
  const { data: sentToday } = await supabase.rpc("social_sent_today", { p_channel: channel });
  const { data: queuedNow } = await supabase.rpc("social_queued_count", { p_channel: channel });
  const cap = cfg?.telegram_daily_cap ?? 20;
  let headroom = queueHeadroom(cap, sentToday ?? 0, queuedNow ?? 0);
  if (headroom <= 0) return json({ ok: true, sent: 0, headroom: 0, reason: "cap_reached", dry_run: !!cfg?.dry_run });

  // Atomic claim (FOR UPDATE SKIP LOCKED) → two clicks cannot double-post, bounded by the
  // remaining capacity for the day rather than by whatever the button asked for.
  const { data: claimed, error: claimErr } = await supabase.rpc("claim_due_social_posts", { p_limit: Math.min(limit, headroom), p_channel: channel });
  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  const rows = (claimed ?? []) as Array<{
    id: string; caption: string; landing_url: string; channel_id: string | null;
    source_type: string; source_id: string;
  }>;
  if (rows.length === 0) return json({ ok: true, sent: 0, dry_run: !!cfg?.dry_run });

  const { data: chat } = await supabase.from("social_channels").select("external_id").eq("channel", channel).eq("is_active", true).limit(1).maybeSingle();

  // J3 — refuse reference TEST content, in both senses the owner named: the record's own
  // slug, and a landing URL whose path carries a zz-test- segment. One batched read for the
  // exam rows, then the row is failed (never sent) with the reason on the log.
  const examIds = rows.filter((r) => r.source_type === "exam").map((r) => r.source_id);
  const testExamIds = new Set<string>();
  if (examIds.length > 0) {
    const { data: slugRows } = await supabase.from("exams").select("id, slug").in("id", examIds);
    for (const s of (slugRows ?? []) as Array<{ id: string; slug: string }>) {
      if (isTestSlug(s.slug)) testExamIds.add(s.id);
    }
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const row of rows) {
    if (testExamIds.has(row.source_id) || landingUrlIsTest(row.landing_url)) {
      await supabase.from("social_posts")
        .update({ status: "failed", error: "reference test content is never posted" })
        .eq("id", row.id);
      await supabase.from("social_publish_log")
        .insert({ post_id: row.id, channel, status: "skipped", provider_code: "test_content", error_message: "reference test content refused before send" });
      results.push({ id: row.id, status: "refused_test_content" });
      continue;
    }
    if (headroom <= 0) {
      await supabase.from("social_posts").update({ status: "approved" }).eq("id", row.id);
      results.push({ id: row.id, status: "cap_reached" });
      continue;
    }
    if (cfg?.dry_run) {
      // DRY RUN: write the EXACT payload to the log, post nothing, return the row to 'approved'.
      await supabase.from("social_publish_log").insert({ post_id: row.id, channel, status: "skipped", provider_code: "dry_run", error_message: null });
      await supabase.from("social_posts").update({ status: "approved" }).eq("id", row.id);
      results.push({ id: row.id, status: "dry_run" });
      continue;
    }
    if (!TG_BOT_TOKEN || !chat?.external_id) {
      await supabase.from("social_posts").update({ status: "failed", error: "missing TG_BOT_TOKEN or chat id" }).eq("id", row.id);
      results.push({ id: row.id, status: "config_missing" });
      continue;
    }
    const payload = telegramPayload(chat.external_id, row.caption);
    // J2-3 — the body is built from the CURRENT caption of the claimed row, never from the
    // stored payload column, and the column is then overwritten with what was actually sent,
    // so `payload` stays the auditable record of the send rather than a stale draft.
    await supabase.from("social_posts").update({ payload }).eq("id", row.id);
    const t0 = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      const latency = Date.now() - t0;
      if (res.ok && j?.ok) {
        headroom -= 1;                       // J2-4: capacity is consumed by a SENT message
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
