/**
 * SocialQueuePage — the S7.1b review/approve screen (Telegram only).
 *
 * Feature-flagged: with FEATURE_FLAGS.SOCIAL_QUEUE off it renders a clear disabled state
 * and touches no DB. When on: a queue list with per-status chips, approve / skip /
 * edit-caption, the channel list (add/edit — super-admin, because that is what the
 * social_channels_admin_write RLS policy allows), a config panel (kill switch, dry-run, cap)
 * shown to all but editable only by super-admin, and a "Run due queue" button.
 *
 * NOTHING HERE POSTS. While `dry_run` is on the worker writes the exact payload to
 * social_publish_log and returns the row to 'approved'; while `kill_switch` is on it returns
 * before claiming anything. The banner below says so in those words, because the only
 * dangerous-looking moment in this screen is a button labelled "Run due queue".
 *
 * EXPORT SHAPE (owner batch 7, Phase S): the router resolves lazy pages by NAME —
 * `lazyPage(() => import("…/SocialQueuePage"), "SocialQueuePage")`. This file used to carry
 * only `export default`, so the resolved component was `undefined`, React threw while
 * rendering the route, and the lazy error boundary showed "Failed to load this page"
 * on the deployed CMS. The named export is the repo convention (every other page has it)
 * and is now pinned by src/router/lazyExports.test.ts. `export default` is kept as well so
 * either import shape works.
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { flagOn } from "@/config/featureFlags";
import { useAuth } from "@/hooks/useAuth";
import {
  listQueue, decide, setCaption, getConfig, setConfig, runDueQueue,
  listChannels, createChannel, updateChannel,
  type SocialPostRow, type SocialConfig, type SocialChannel,
} from "@/services/social/socialQueueService";

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600", approved: "bg-blue-50 text-blue-700",
  queued: "bg-amber-50 text-amber-700", sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700", skipped: "bg-slate-100 text-slate-500",
};

export function SocialQueuePage() {
  const enabled = flagOn("SOCIAL_QUEUE");
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.roleSlug === "super-admin";
  const [rows, setRows] = useState<SocialPostRow[]>([]);
  const [cfg, setCfg] = useState<SocialConfig | null>(null);
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [q, c, ch] = await Promise.all([listQueue(), getConfig(), listChannels()]);
      setRows(q); setCfg(c); setChannels(ch);
    }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { load(); }, [load]);

  if (!enabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Social queue</h1>
        <p className="text-sm text-slate-500">
          Disabled by <code>FEATURE_FLAGS.SOCIAL_QUEUE</code> in <code>src/config/featureFlags.ts</code>.
          The schema is applied and <code>social-candidate</code> / <code>social-publish</code> are deployed,
          so flipping that flag (and rebuilding the CMS, because it is compiled into the bundle) is all
          that stands between this and the queue. Until then this page touches no database at all.
        </p>
      </div>
    );
  }

  const act = async (id: string, status: "approved" | "skipped") => {
    try { await decide(id, status); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const saveCaption = async (id: string) => {
    try { await setCaption(id, draft); setEditing(null); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const run = async () => {
    try { const r = await runDueQueue(); toast.success(r.killed ? "Kill switch on — nothing sent" : r.dry_run ? "Dry run complete (nothing posted)" : `Ran ${r.results?.length ?? 0}`); await load(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const patchCfg = async (p: Partial<SocialConfig>) => {
    try { await setConfig(p); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const addChannel = async () => {
    try { await createChannel({ label: newLabel, external_id: newChatId }); setNewLabel(""); setNewChatId(""); await load(); toast.success("Channel added"); }
    catch (e) { toast.error((e as Error).message); }
  };
  const toggleChannel = async (ch: SocialChannel) => {
    try { await updateChannel(ch.id, { is_active: !ch.is_active }); await load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const activeTelegram = channels.filter((c) => c.is_active && c.external_id);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* P3 — the safety state is said out loud, at the top, in the same words the worker
          uses. It is read from the row the database actually holds, not from a constant. */}
      {cfg && (cfg.kill_switch || cfg.dry_run) && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            {cfg.kill_switch
              ? "KILL SWITCH ON: nothing is posted to any channel."
              : "DRY RUN: nothing is posted — the exact message is written to the log and the item returns to Approved."}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {cfg.kill_switch
              ? "Running the queue claims nothing while this is on. Un-tick \"Kill switch\" below to reach the dry-run step."
              : "Un-tick \"Dry run\" to send for real. The daily cap is " + cfg.telegram_daily_cap + " posts per day, and only then does Telegram get anything."}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Social queue — Telegram</h1>
        <button onClick={run} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Run due queue {cfg?.dry_run ? "(dry run)" : ""}
        </button>
      </div>

      {/* Config panel — visible to all, editable by super-admin only (RLS enforces it too). */}
      {cfg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.kill_switch} disabled={!isSuperAdmin} onChange={(e) => patchCfg({ kill_switch: e.target.checked })} /> Kill switch</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.dry_run} disabled={!isSuperAdmin} onChange={(e) => patchCfg({ dry_run: e.target.checked })} /> Dry run</label>
          <label className="flex items-center gap-2">Daily cap
            <input type="number" min={0} value={cfg.telegram_daily_cap} disabled={!isSuperAdmin}
              onChange={(e) => patchCfg({ telegram_daily_cap: Number(e.target.value) })} className="w-20 rounded border border-slate-300 px-2 py-1" />
          </label>
          {!isSuperAdmin && <span className="text-xs text-slate-400">config editable by super-admin only</span>}
        </div>
      )}

      {/* Channels (P2) — where a post would go. super-admin only, which is also exactly what
          the social_channels_admin_write RLS policy enforces, so a non-super-admin sees the
          list (staff_read needs manage_social) but no editor. No field here can carry a bot
          token: the token lives in Supabase Edge Function Secrets and the browser cannot read
          or write that. */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Telegram channels</h2>
        <p className="text-xs text-slate-500 mb-3">
          The label is for the queue; the chat id is what Telegram is addressed with — a public
          handle (@name) or a numeric id (-100… for a channel/supergroup). The bot token is
          NEVER stored here: it lives only in Supabase → Edge Functions → Secrets as
          <code> TG_BOT_TOKEN</code>, which this page cannot read.
        </p>

        {channels.length === 0 && (
          <p className="text-xs text-slate-500 mb-3">No channel configured yet — a real send (not a dry run) would report <code>config_missing</code> until one is added.</p>
        )}
        {activeTelegram.length > 1 && (
          <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {activeTelegram.length} active channels are configured. The publish worker picks one active row for “telegram” — keep exactly one active to remove the ambiguity.
          </p>
        )}

        <ul className="divide-y divide-slate-100 text-sm">
          {channels.map((ch) => (
            <li key={ch.id} className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium text-slate-800">{ch.label}</span>
              <code className="text-xs text-slate-600">{ch.external_id || "(no chat id)"}</code>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${ch.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {ch.is_active ? "active" : "inactive"}
              </span>
              {isSuperAdmin && (
                <button onClick={() => toggleChannel(ch)} className="text-xs rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                  {ch.is_active ? "Set inactive" : "Set active"}
                </button>
              )}
            </li>
          ))}
        </ul>

        {isSuperAdmin && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Main channel)"
              className="flex-1 min-w-[180px] rounded border border-slate-300 px-2 py-1.5 text-sm" />
            <input value={newChatId} onChange={(e) => setNewChatId(e.target.value)} placeholder="@channelname or -1001234567890"
              className="flex-1 min-w-[220px] rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" />
            <button onClick={addChannel} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Add channel</button>
          </div>
        )}
        {!isSuperAdmin && <p className="mt-2 text-xs text-slate-400">Channels are added and edited by super-admin only (enforced by RLS as well as by this view).</p>}
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          Nothing in the queue. Candidates appear here when an exam update is published or an
          exam is verified. (Unverified records never queue.)
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="font-medium text-slate-800 truncate">{r.source_label ?? r.id}</span>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_CHIP[r.status] ?? "bg-slate-100"}`}>{r.status}</span>
            </div>
            {editing === r.id ? (
              <div className="space-y-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full rounded border border-slate-300 p-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => saveCaption(r.id)} className="text-xs rounded bg-blue-600 text-white px-3 py-1.5">Save caption</button>
                  <button onClick={() => setEditing(null)} className="text-xs rounded border border-slate-300 px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-600">{r.caption}</p>
            )}
            <a href={r.landing_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">{r.landing_url}</a>
            {r.status === "draft" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => act(r.id, "approved")} className="text-xs rounded bg-green-600 text-white px-3 py-1.5">Approve</button>
                <button onClick={() => act(r.id, "skipped")} className="text-xs rounded border border-slate-300 px-3 py-1.5">Skip</button>
                <button onClick={() => { setEditing(r.id); setDraft(r.caption); }} className="text-xs rounded border border-slate-300 px-3 py-1.5">Edit caption</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kept for any importer that uses the default form; the router uses the named export. */
export default SocialQueuePage;
