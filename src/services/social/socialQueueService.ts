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
 */
export async function createCandidate(input: { source_type: string; source_id: string; event: string; page_url: string }): Promise<void> {
  if (!flagOn("SOCIAL_QUEUE")) return;
  try {
    await db.functions.invoke("social-candidate", { body: { channel: "telegram", ...input } });
  } catch (e) {
    // Swallow — log only. The record is already published/verified; the candidate can be
    // recreated by a human. This must never bubble up to the publish/verify UI.
    console.warn("[social] candidate hook failed (non-blocking):", (e as Error).message);
  }
}
