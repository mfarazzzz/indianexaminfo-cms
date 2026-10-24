/**
 * SocialQueuePage — the S7.1b review/approve screen (Telegram only).
 *
 * Feature-flagged: with FEATURE_FLAGS.SOCIAL_QUEUE off (the schema is not applied and
 * the functions are not deployed) it renders a clear disabled state and touches no DB.
 * When on: a queue list with per-status chips, approve / skip / edit-caption, a config
 * panel (kill switch, dry-run, cap) shown to all but editable only by super-admin, and a
 * "Run due queue" button that stays in dry-run until the owner flips it.
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { flagOn } from "@/config/featureFlags";
import { useAuth } from "@/hooks/useAuth";
import {
  listQueue, decide, setCaption, getConfig, setConfig, runDueQueue,
  type SocialPostRow, type SocialConfig,
} from "@/services/social/socialQueueService";

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600", approved: "bg-blue-50 text-blue-700",
  queued: "bg-amber-50 text-amber-700", sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700", skipped: "bg-slate-100 text-slate-500",
};

export default function SocialQueuePage() {
  const enabled = flagOn("SOCIAL_QUEUE");
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.roleSlug === "super-admin";
  const [rows, setRows] = useState<SocialPostRow[]>([]);
  const [cfg, setCfg] = useState<SocialConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try { setRows(await listQueue()); setCfg(await getConfig()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { load(); }, [load]);

  if (!enabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Social queue</h1>
        <p className="text-sm text-slate-500">
          Disabled — the social-queue schema is not applied and the Telegram functions are not
          deployed. Enable it in <code>src/config/featureFlags.ts</code> after the owner applies
          <code> supabase/proposed/20261012140000_social_queue.sql</code> and deploys the functions.
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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
