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
 *
 * Owner batch 9:
 *   P1 — CORS. It answers the browser preflight BEFORE the bearer check, and every
 *        response (401/400/404/422/500/502/success) carries the CORS headers. Without
 *        that the browser blocked the call and supabase-js reported "Failed to send a
 *        request to the Edge Function" instead of the function's own answer.
 *   P3 — `{action:"check_channel"}`: a READ-ONLY getChat/getMe/getChatMember look at
 *        one configured channel, allowed with the kill switch ON because it posts
 *        nothing. Super-admin only, re-checked through current_user_role().
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  queueHeadroom, redactError, telegramPayload, testContentRefusal, VACANCY_SOURCE_TYPE,
  corsFor, jsonWith, preflightFor,
} from "../_shared/social.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TG_BOT_TOKEN = Deno.env.get("TG_BOT_TOKEN") ?? "";
/**
 * The browser origins allowed to call this function — the SAME ALLOWED_ORIGINS secret
 * ai-fill and revalidate-frontend already read (owner batch 9, P1). Never "*".
 */
const ALLOWED_ORIGINS: string[] = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);

Deno.serve(async (req) => {
  // ── P1 (owner batch 9): the preflight comes FIRST, before any auth check ──────
  // Proven live on 2026-11-08 06:10Z: the owner's two clicks on "Run due queue" sent
  // an OPTIONS preflight that fell through to the bearer check below, came back 401
  // with no Access-Control-Allow-Origin, and the browser turned that into
  // "Failed to send a request to the Edge Function".
  const pre = preflightFor(req.method, req.headers.get("Origin"), ALLOWED_ORIGINS);
  if (pre) return pre;
  const cors = corsFor(req.headers.get("Origin"), ALLOWED_ORIGINS);
  if (!cors.allowed) return jsonWith({ ok: false, error: "Origin not allowed" }, 403, cors.headers);
  if (req.method !== "POST") return jsonWith({ ok: false, error: "Method not allowed" }, 405, cors.headers);

  // Every response below leaves through `json`, so the 401, the 500, the refusals and
  // the success body all carry the CORS headers. An error the browser cannot read is
  // indistinguishable from a network failure — which is exactly the bug this fixes.
  const json = (o: unknown, status = 200) => jsonWith(o, status, cors.headers);

  // verify_jwt is ON; also require a user bearer token so an unauthenticated call fails.
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || !SERVICE_KEY) return json({ ok: false, error: "unauthorized" }, 401);
  let body: { limit?: number; channel?: string; action?: string; channel_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const channel = body.channel ?? "telegram";
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── P3: "Check channel" — READ-ONLY, and deliberately BEFORE the kill switch ──
  // It posts nothing, and the moment an operator needs it is while the switch is
  // still on, so the kill_switch short-circuit below must not swallow it.
  if (body.action === "check_channel") {
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    return await checkChannel(caller, String(body.channel_id ?? ""), json);
  }

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

  // J3/P5 — refuse reference TEST content, in both senses the owner named: the record's own
  // slug, and a landing URL whose path carries a zz-test- segment. One batched read for the
  // exam ids, then the shared predicate (unit-tested, not grepped) decides; the row is FAILED
  // — never sent — with the reason on the log.
  const examIds = rows.filter((r) => r.source_type === "exam").map((r) => r.source_id);
  const examSlugById: Record<string, string> = {};
  if (examIds.length > 0) {
    const { data: slugRows } = await supabase.from("exams").select("id, slug").in("id", examIds);
    for (const s of (slugRows ?? []) as Array<{ id: string; slug: string }>) {
      if (s?.id && typeof s.slug === "string") examSlugById[s.id] = s.slug;
    }
  }

  // Owner batch 8, H3 — the SAME guard for a VACANCY row. A vacancy candidate carries
  // source_type 'sarkari_naukri', so its id is not in the exam map above. The landing URL
  // would still catch a zz-test- slug, but the record's OWN slug is the direct check, and
  // it must not depend on the URL having been resolved.
  const vacancyIds = rows.filter((r) => r.source_type === VACANCY_SOURCE_TYPE).map((r) => r.source_id);
  const vacancySlugById: Record<string, string> = {};
  if (vacancyIds.length > 0) {
    const { data: slugRows } = await supabase.from("sarkari_naukri").select("id, slug").in("id", vacancyIds);
    for (const s of (slugRows ?? []) as Array<{ id: string; slug: string }>) {
      if (s?.id && typeof s.slug === "string") vacancySlugById[s.id] = s.slug;
    }
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const row of rows) {
    const refusal = testContentRefusal({ landingUrl: row.landing_url, examSlugById, vacancySlugById, sourceId: row.source_id });
    if (refusal) {
      await supabase.from("social_posts")
        .update({ status: "failed", error: `reference test content is never posted (${refusal})` })
        .eq("id", row.id);
      await supabase.from("social_publish_log")
        .insert({ post_id: row.id, channel, status: "skipped", provider_code: "test_content", error_message: `refused before send: ${refusal}` });
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

/**
 * P3 (owner batch 9) — "Check channel": a READ-ONLY look at one configured chat.
 *
 * It runs getChat, getMe and getChatMember and nothing else. No posting method is
 * reachable from this function, so a check cannot put a message in a channel.
 *
 * Placement: called BEFORE the kill_switch read. A check writes nothing and posts
 * nothing, and the moment an operator needs it is exactly while the switch is still
 * on — so the switch must not swallow it.
 *
 * THE TOKEN. Read from env, used only inside the request URL, and never returned,
 * never put in a payload, and never left in a thrown error: a failing fetch's message
 * can contain the request URL, and that URL contains the token, so every description
 * goes through redactError. Nothing about the channel's contents is read or logged —
 * one line with the chat id, its type and the bot's status, never a title in the log
 * and never a message.
 *
 * Super-admin only, re-checked here through current_user_role() with the CALLER's own
 * token, so the CMS hiding the button is not the only thing enforcing it.
 */
async function checkChannel(
  caller: any,
  channelId: string,
  json: (o: unknown, status?: number) => Response,
): Promise<Response> {
  if (!channelId) return json({ ok: false, reason: "Pick a channel to check." }, 400);

  const { data: role, error: roleErr } = await caller.rpc("current_user_role");
  if (roleErr) return json({ ok: false, reason: "Could not confirm your role, so the channel was not checked." }, 500);
  if (role !== "super-admin") return json({ ok: false, reason: "Only a super-admin can check a channel." }, 403);

  const { data: row, error: rowErr } = await caller.from("social_channels")
    .select("id, external_id, is_active").eq("id", channelId).maybeSingle();
  if (rowErr) return json({ ok: false, reason: "Could not read that channel row." }, 500);
  if (!row) return json({ ok: false, reason: "That channel no longer exists." }, 404);

  const chatId = String(row.external_id ?? "").trim();
  if (!chatId) return json({ ok: false, reason: "This channel has no chat id yet, so there is nothing to check." }, 422);
  if (!TG_BOT_TOKEN) {
    return json({ ok: false, reason: "TG_BOT_TOKEN is not set in the function secrets, so the channel cannot be checked." }, 502);
  }

  // The token appears ONLY in this URL. The result object carries nothing from it.
  const token = TG_BOT_TOKEN;
  const call = async (method: string, params: Record<string, unknown>) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params),
      });
      const j = await res.json().catch(() => ({} as any));
      return {
        ok: !!j?.ok,
        result: j?.result ?? null,
        description: redactError(String(j?.description ?? ""), token),
      };
    } catch (e) {
      return { ok: false, result: null, description: redactError(String(e), token) };
    }
  };

  const chat = await call("getChat", { chat_id: chatId });
  if (!chat.ok || !chat.result) {
    return json({
      ok: false, chat_id: chatId, bot_is_admin: false, can_post_messages: false,
      reason: `Telegram could not find that chat (${chat.description || "no reason given"}). A channel is addressed by its @handle or by an id starting -100, and the bot has to be added to it.`,
    });
  }

  const chatType = String((chat.result as any).type ?? "");
  const chatTitle = String((chat.result as any).title ?? (chat.result as any).username ?? "");

  // getChat() succeeds for a bot's own username, which is a 'private' chat: that is
  // exactly the mistake the owner's first row made, so it gets its own plain answer.
  if (chatType === "private") {
    return json({
      ok: false, chat_id: chatId, chat_title: chatTitle, chat_type: chatType,
      bot_is_admin: false, can_post_messages: false,
      reason: "That is a bot or a person, not a channel. Channel ids start with -100; a channel is also addressable by its public @handle.",
    });
  }

  const me = await call("getMe", {});
  const botId = (me.result as any)?.id;
  if (!me.ok || !botId) {
    return json({
      ok: false, chat_id: chatId, chat_title: chatTitle, chat_type: chatType,
      reason: `Telegram would not identify the bot (${me.description || "no reason given"}).`,
    });
  }

  const member = await call("getChatMember", { chat_id: chatId, user_id: botId });
  const m = (member.result ?? {}) as any;
  const status = String(m?.status ?? "");

  if (!member.ok) {
    return json({
      ok: false, chat_id: chatId, chat_title: chatTitle, chat_type: chatType,
      bot_is_admin: false, can_post_messages: false,
      reason: `The bot is not in that channel, or Telegram would not say (${member.description || "no reason given"}). Add the bot as an administrator of the channel.`,
    });
  }

  const isAdmin = status === "administrator" || status === "creator";
  // `can_post_messages` is OPTIONAL in Telegram's ChatMemberAdministrator type and
  // describes a CHANNEL admin's right to post. Absent means "not restricted", so it is
  // false only when Telegram says false: reporting an absent optional field as a
  // refusal would be inventing one.
  const canPost = isAdmin && m?.can_post_messages !== false;
  const common = {
    chat_id: chatId, chat_title: chatTitle, chat_type: chatType,
    bot_is_admin: isAdmin, can_post_messages: canPost, bot_status: status,
  };

  // One log line: id, type, status. No title, no message, no token.
  console.log(`[social-publish] check_channel chat=${chatId} type=${chatType} bot_status=${status}`);

  if (!isAdmin) {
    const why = status === "left" || status === "kicked"
      ? "The bot is not in that channel."
      : status === "restricted"
        ? "The bot's permissions in that channel are restricted."
        : "The bot is in the channel but is not an administrator, so it cannot post.";
    return json({ ok: false, ...common, reason: `${why} Promote the bot to administrator with "Post messages".` });
  }
  if (!canPost) {
    return json({ ok: false, ...common, reason: "The bot is an administrator, but Telegram says it may not post messages in this channel." });
  }
  return json({ ok: true, ...common });
}
