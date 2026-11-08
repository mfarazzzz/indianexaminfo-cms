/**
 * socialQueueService.ts — data access for the CMS Social queue (S7.1b).
 *
 * Every function is a no-op / throws a friendly error when FEATURE_FLAGS.SOCIAL_QUEUE
 * is off (the schema is not applied), so importing this module is always safe. Reads
 * and writes go through the user's own client (RLS manage_social gates them); the two
 * privileged actions (create candidate, run due queue) call the edge functions, which
 * hold the service role + TG_BOT_TOKEN in their own env.
 */
import { db } from "@/lib/supabase/client";
import { flagOn } from "@/config/featureFlags";
import { isTestSlug } from "@/lib/testContent";

export type SocialStatus = "draft" | "approved" | "queued" | "sent" | "failed" | "skipped";
export interface SocialPostRow {
  id: string; status: SocialStatus; channel: string; source_label: string | null;
  caption: string; landing_url: string; attempts: number; scheduled_at: string | null;
  approved_at: string | null; error: string | null;
}
export interface SocialConfig { kill_switch: boolean; dry_run: boolean; telegram_daily_cap: number; }

const DISABLED = "Social queue is disabled (schema not applied).";

export async function listQueue(): Promise<SocialPostRow[]> {
  if (!flagOn("SOCIAL_QUEUE")) return [];
  const { data, error } = await db.from("social_posts")
    .select("id,status,channel,source_label,caption,landing_url,attempts,scheduled_at,approved_at,error")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as SocialPostRow[];
}

export async function setCaption(id: string, caption: string): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) throw new Error(DISABLED);
  const { error } = await db.from("social_posts").update({ caption }).eq("id", id);
  if (error) throw error;
}

/** approve / skip / reject — the staff-allowed transitions (the trigger blocks 'sent'). */
export async function decide(id: string, status: "approved" | "skipped"): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) throw new Error(DISABLED);
  const { error } = await db.from("social_posts").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function getConfig(): Promise<SocialConfig | null> {
  if (!flagOn("SOCIAL_QUEUE")) return null;
  const { data } = await db.from("social_config").select("kill_switch,dry_run,telegram_daily_cap").eq("id", 1).maybeSingle();
  return (data as SocialConfig) ?? null;
}

/** super-admin only (enforced by the social_config_admin_write RLS policy). */
export async function setConfig(patch: Partial<SocialConfig>): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) throw new Error(DISABLED);
  const { error } = await db.from("social_config").update({ ...patch, updated_by: (await db.auth.getUser()).data.user?.id ?? null }).eq("id", 1);
  if (error) throw error;
}

/** "Run due queue" → the social-publish edge function (dry-run unless the owner flipped it). */
export async function runDueQueue(limit = 10): Promise<{ ok: boolean; killed?: boolean; dry_run?: boolean; results?: unknown[] }> {
  if (!flagOn("SOCIAL_QUEUE")) return { ok: false };
  const { data, error } = await db.functions.invoke("social-publish", { body: { limit, channel: "telegram" } });
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; killed?: boolean; dry_run?: boolean; results?: unknown[] };
}

/**
 * Candidate hook — called fire-and-forget from the publish/verify paths. NEVER throws
 * to the caller: a social failure must not block publish or verify. No-op when off.
 *
 * J3/P5 — the FIRST of the three guards. A reference TEST record is never queued, and the
 * client knows the slug it is acting on, so it does not even spend a request: an editor who
 * publishes a `zz-test-` exam sees the publish succeed and no candidate appear, which is the
 * intended behaviour (the row is a fixture, not content). social-candidate refuses it again
 * (422) and social-publish refuses it a third time at send, so no caller path can reach the
 * channel with test content — this guard is a convenience, never the security boundary.
 */
export async function createCandidate(input: {
  source_type: string; source_id: string; event: string; page_url: string; slug?: string | null;
}): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) return;
  if (isTestSlug(input.slug)) {
    // console.warn, not an error toast: a publish that succeeded must not look like it failed.
    console.warn(`[social] candidate skipped for reference test content (${input.slug})`);
    return;
  }
  try {
    const { slug: _slug, ...body } = input;   // the edge function takes no slug; it looks the record up itself
    const { error } = await db.functions.invoke("social-candidate", { body: { channel: "telegram", ...body } });
    // invoke() resolves for a 4xx, so a refusal has to be read off the response — logged, and
    // still never thrown, because the record IS published at this point.
    if (error) console.warn("[social] candidate refused (non-blocking):", error.message);
  } catch (e) {
    // Swallow — log only. The record is already published/verified; the candidate can be
    // recreated by a human. This must never bubble up to the publish/verify UI.
    console.warn("[social] candidate hook failed (non-blocking):", (e as Error).message);
  }
}

// ── Channels (owner batch 5, P2) ──────────────────────────────────────────────
// `social_channels` holds WHERE a post would go: a human label plus the PUBLIC chat id
// Telegram needs to address it. It is deliberately the only place a channel is configured,
// and it holds no secret: the bot token lives in Supabase Edge Function Secrets (TG_BOT_TOKEN),
// which the browser can neither read nor write — nothing in this panel can carry one.

export interface SocialChannel {
  id: string; channel: string; label: string; external_id: string | null; is_active: boolean;
}

/**
 * What a Telegram chat id may be (P2; tightened in owner batch 9).
 *
 * A chat id is one of exactly two public shapes:
 *   • a public channel handle  →  @name, 5–32 chars, letter first [A-Za-z0-9_];
 *   • a numeric channel/supergroup id  →  the -100… form.
 *
 * TWO VALUES THAT LOOK PLAUSIBLE ARE NOW REFUSED, each with its own sentence,
 * because both were actually entered on this panel on 2026-11-06 and neither can ever
 * work at send time:
 *   • a handle ending in "bot" IS the bot, not a channel. Telegram reserves the "bot"
 *     suffix for bots, and a bot cannot post to itself.
 *   • a positive number is a person's user id (or a bot's), not a channel. Channels and
 *     supergroups are negative and start -100; addressing a person means the "post"
 *     becomes a private message to a stranger.
 *
 * Anything else is refused with a message that says what IS accepted, because a wrong
 * chat_id is otherwise discovered only when a real send fails on the channel.
 * Returns an error string, or null when the value is usable.
 */
export function validateTelegramChatId(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "Enter the public chat id: @channelname or a numeric id such as -1001234567890.";
  if (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v)) {
    if (/bot$/i.test(v.slice(1))) return "That is a bot, not a channel.";
    return null;
  }
  if (/^-100\d{5,17}$/.test(v)) return null;
  if (/^\d+$/.test(v)) return "Channel ids start with -100; a positive number is a person or a bot.";
  return "Not a Telegram chat id. Use @channelname (5–32 characters, letters, digits and underscores) or a numeric id like -1001234567890.";
}

/** Label is required and unique per channel (DB: UNIQUE (channel, label)). */
export function validateChannelLabel(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "Give the channel a label — it is what the queue and the log show.";
  if (v.length > 80) return "Keep the label under 80 characters.";
  return null;
}

export async function listChannels(): Promise<SocialChannel[]> {
  if (!flagOn("SOCIAL_QUEUE")) return [];
  const { data, error } = await db.from("social_channels")
    .select("id,channel,label,external_id,is_active")
    .order("channel").order("label");
  if (error) throw error;
  return (data ?? []) as SocialChannel[];
}

/**
 * P2 (owner batch 9) — leave `id` as the ONLY active row in its channel group.
 *
 * The publish worker picks ONE active row (`.limit(1).maybeSingle()`), so two active
 * telegram rows make the destination of every post a coin toss. `neq` rather than
 * "deactivate all then reactivate": if this write fails, the previous state stands
 * instead of leaving nothing active.
 */
async function deactivateOthers(id: string, channel: string): Promise<void> {
  const { error } = await db.from("social_channels")
    .update({ is_active: false })
    .eq("channel", channel)
    .eq("is_active", true)
    .neq("id", id);
  if (error) throw error;
}

/** Insert a channel. super-admin only — the social_channels_admin_write RLS policy enforces it. */
export async function createChannel(input: { label: string; external_id: string; is_active?: boolean }): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) throw new Error(DISABLED);
  const labelErr = validateChannelLabel(input.label);
  if (labelErr) throw new Error(labelErr);
  const idErr = validateTelegramChatId(input.external_id);
  if (idErr) throw new Error(idErr);
  const active = input.is_active ?? true;
  // `select("id").single()` so the new row can be excluded from the deactivation below.
  // Everything that can be refused is refused ABOVE this point, so a failed insert
  // cannot have already knocked out the channel that was working.
  const { data: created, error } = await db.from("social_channels").insert({
    channel: "telegram", label: input.label.trim(), external_id: input.external_id.trim(), is_active: active,
  }).select("id").single();
  if (error) throw error;
  const newId = (created as { id?: string } | null)?.id;
  if (active && newId) await deactivateOthers(newId, "telegram");
}

/** Patch a channel (label / chat id / active). Same super-admin policy. */
export async function updateChannel(id: string, patch: Partial<Pick<SocialChannel, "label" | "external_id" | "is_active">>): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) throw new Error(DISABLED);
  if (patch.label !== undefined) {
    const err = validateChannelLabel(patch.label);
    if (err) throw new Error(err);
  }
  if (patch.external_id !== undefined) {
    // `null` is legal in the column but not from this panel: an active channel with no chat id
    // is a row that silently cannot send, so clearing it is refused like any other bad value.
    const err = validateTelegramChatId(patch.external_id ?? "");
    if (err) throw new Error(err);
  }

  // P2 (owner batch 9) — switching a row ON is the moment its stored chat id starts to
  // matter, so the value the worker would actually use is validated NOW. The owner's two
  // rows saved before these rules existed (@…bot and a positive number) therefore cannot
  // be activated without being corrected first — they are not deleted, just not usable.
  if (patch.is_active === true) {
    const { data: current, error: readErr } = await db.from("social_channels")
      .select("external_id, channel").eq("id", id).maybeSingle();
    if (readErr) throw readErr;
    if (!current) throw new Error("That channel no longer exists.");
    const row = current as { external_id?: string | null; channel?: string | null };
    const effective = patch.external_id ?? row.external_id ?? "";
    const idErr = validateTelegramChatId(effective);
    if (idErr) throw new Error(idErr);

    const { channel: _c, id: _i, ...rest } = patch as SocialChannel;
    const { error: onErr } = await db.from("social_channels").update(rest).eq("id", id);
    if (onErr) throw onErr;
    await deactivateOthers(id, row.channel ?? "telegram");
    return;
  }

  const { channel: _channel, id: _id, ...rest } = patch as SocialChannel;
  const { error } = await db.from("social_channels").update(rest).eq("id", id);
  if (error) throw error;
}

/**
 * P3 (owner batch 9) — the answer to "Check channel".
 *
 * Every field is what TELEGRAM said, plus a plain-language `reason` when the answer is
 * no. The function behind it runs getChat / getMe / getChatMember only, so a check can
 * never post anything, and it is allowed while the kill switch is on because the moment
 * an operator needs it is before anything is switched on.
 */
export interface ChannelCheck {
  ok: boolean;
  chat_id?: string;
  chat_title?: string;
  chat_type?: string;
  bot_is_admin?: boolean;
  /** Absent/false when the bot may not post; true only when Telegram does not forbid it. */
  can_post_messages?: boolean | null;
  bot_status?: string;
  reason?: string;
}

/**
 * Ask social-publish to look at one configured channel. READ-ONLY, super-admin only
 * (re-checked in the function through current_user_role(), not just here).
 *
 * `invoke()` resolves rather than throws for a 4xx, so the function's own `reason` is
 * what reaches the operator — that is the whole point of this button.
 */
export async function checkChannel(channelId: string): Promise<ChannelCheck> {
  if (!flagOn("SOCIAL_QUEUE")) return { ok: false, reason: DISABLED };
  const { data, error } = await db.functions.invoke("social-publish", {
    body: { action: "check_channel", channel_id: channelId },
  });
  if (error) throw error;
  return (data ?? { ok: false, reason: "No answer from the channel check." }) as ChannelCheck;
}
