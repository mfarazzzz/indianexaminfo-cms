/**
 * ExamUpdatesPanel.tsx — D-P2 commit 3/4: the "Updates" surface inside the
 * News & Updates rail section. A per-exam feed authored as content_posts via
 * examUpdatesService. This panel writes IMMEDIATELY (its own Save), unlike the
 * legacy news list (which rides the editor's main Save through content_modules) —
 * an update is a standalone record with its own publish/expiry/supersede life.
 *
 * Publish is gated on the publish_post permission (RLS enforces it too); a
 * role without it authors drafts only. Withdraw sets kind='withdrawn' and keeps
 * the post published so readers still see the history.
 */
import React, { useEffect, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import type { ContentType } from "@/types/exam";
import {
  listExamUpdates, createExamUpdate, updateExamUpdate, withdrawExamUpdate,
  reorderExamUpdates, type ExamUpdate, type NewExamUpdate, type UpdateKind, type UpdateLink,
} from "@/services/examUpdatesService";
import { UPDATE_KINDS } from "@/services/examUpdatesService";

const CONTENT_TYPES: ContentType[] = ["notification", "application", "admit-card", "answer-key", "result", "cutoff", "date-sheet"];

const KIND_LABEL: Record<UpdateKind, string> = {
  provisional: "Provisional", final: "Final", revised: "Revised", corrigendum: "Corrigendum", withdrawn: "Withdrawn",
};

const emptyForm = () => ({ title: "", contentType: "notification" as ContentType, kind: "provisional" as UpdateKind, body: "", expiresAt: "", isPinned: false });

export function ExamUpdatesPanel({ examId, examEditionId, pillar, initialDraft, onCountChange }: {
  examId: string;
  examEditionId?: string | null;
  pillar?: string;
  /** A draft prefilled "from a notice" (D-P2 commit 4) — opens the form filled. */
  initialDraft?: NewExamUpdate | null;
  onCountChange?: (n: number) => void;
}) {
  const canPublish = usePermission(P.PUBLISH_POST);
  const [updates, setUpdates] = useState<ExamUpdate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [links, setLinks] = useState<UpdateLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try { const rows = await listExamUpdates(examId); setUpdates(rows); onCountChange?.(rows.length); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load updates"); }
  };
  useEffect(() => { void reload(); }, [examId]);

  // A notice prefill opens the form filled (body still the editor's to write).
  useEffect(() => {
    if (!initialDraft) return;
    setEditingId(null);
    setForm({ title: initialDraft.title, contentType: initialDraft.contentType, kind: initialDraft.kind ?? "provisional", body: initialDraft.body ?? "", expiresAt: initialDraft.expiresAt ?? "", isPinned: initialDraft.isPinned ?? false });
    setLinks(initialDraft.quickLinks ?? []);
    setShowForm(true);
  }, [initialDraft]);

  const slugFrom = (title: string) => (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "update") + "-" + Math.random().toString(36).slice(2, 6);

  const save = async (publish: boolean) => {
    if (!form.title.trim()) { setError("A title is required"); return; }
    setBusy(true); setError(null);
    try {
      const status = publish ? "published" : "draft";
      const payload: NewExamUpdate = {
        examId, examEditionId: examEditionId ?? null, pillar, slug: slugFrom(form.title),
        contentType: form.contentType, title: form.title.trim(), body: form.body, kind: form.kind,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null, isPinned: form.isPinned,
        quickLinks: links, status,
      };
      if (editingId) await updateExamUpdate(editingId, { ...payload, slug: undefined } as never);
      else await createExamUpdate(payload);
      setShowForm(false); setEditingId(null); setForm(emptyForm()); setLinks([]);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the update"); }
    finally { setBusy(false); }
  };

  const startEdit = (u: ExamUpdate) => {
    setEditingId(u.id);
    setForm({ title: u.title, contentType: u.contentType, kind: u.kind, body: u.body, expiresAt: u.expiresAt ? u.expiresAt.slice(0, 10) : "", isPinned: u.isPinned });
    setLinks(u.quickLinks); setShowForm(true);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...updates]; const j = idx + dir; if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setUpdates(next);
    try { await reorderExamUpdates(examId, next.map((u) => u.id)); } catch { void reload(); }
  };

  return (
    <div className="space-y-3" data-testid="exam-updates-panel">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Updates <span className="text-slate-400">({updates.length})</span></h4>
        {!showForm && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm()); setLinks([]); setShowForm(true); setError(null); }} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-medium">➕ Add update</button>}
      </div>
      <p className="text-[11px] text-slate-500">Exam updates save immediately (not with the main Save). Publishing needs the publish permission; without it you can only save drafts.</p>

      {error && <p className="text-xs text-rose-600" data-testid="updates-error">{error}</p>}

      {showForm && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50" data-testid="updates-form">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Update title *" className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as ContentType })} className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm">
              {CONTENT_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as UpdateKind })} className="rounded border border-slate-200 px-2 py-1.5 text-sm">
              {UPDATE_KINDS.filter((k) => k !== "withdrawn").map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the update in your own words (facts from the notice — never copy the page's prose)" rows={4} className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1">Expires <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="rounded border border-slate-200 px-1.5 py-1" /></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="rounded" /> Pinned</label>
          </div>
          <LinkEditor links={links} onChange={setLinks} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => save(false)} className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50">Save draft</button>
            {canPublish && <button type="button" disabled={busy} onClick={() => save(true)} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Publish</button>}
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 rounded text-slate-500 hover:bg-slate-100">Cancel</button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {updates.map((u, i) => (
          <li key={u.id} className="border border-slate-200 rounded-lg p-2.5 text-sm" data-testid="update-row">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{u.title}</p>
                <p className="text-[11px] text-slate-500">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-1">{KIND_LABEL[u.kind]}</span>
                  <span className="capitalize">{u.contentType}</span> · {u.status}
                  {u.isPinned && " · 📌"}{u.expiresAt && ` · expires ${u.expiresAt.slice(0, 10)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" disabled={i === updates.length - 1} onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => startEdit(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                {u.kind !== "withdrawn" && <button type="button" onClick={async () => { await withdrawExamUpdate(u.id); void reload(); }} className="text-xs text-amber-600 hover:underline">Withdraw</button>}
                {canPublish && u.status !== "published" && <button type="button" onClick={async () => { await updateExamUpdate(u.id, { status: "published" }); void reload(); }} className="text-xs text-green-600 hover:underline">Publish</button>}
                {canPublish && u.status === "published" && <button type="button" onClick={async () => { await updateExamUpdate(u.id, { status: "unpublished" }); void reload(); }} className="text-xs text-slate-500 hover:underline">Unpublish</button>}
              </div>
            </div>
          </li>
        ))}
        {updates.length === 0 && !showForm && <li className="text-xs text-slate-400 py-2">No updates yet. Add one, or create one from a notice in the review drawer.</li>}
      </ul>
    </div>
  );
}

function LinkEditor({ links, onChange }: { links: UpdateLink[]; onChange: (l: UpdateLink[]) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-slate-500">Links (label + address only — a link with no address is dropped)</p>
      {links.map((l, i) => (
        <div key={i} className="flex gap-1">
          <input value={l.label} onChange={(e) => onChange(links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs" />
          <input value={l.url} onChange={(e) => onChange(links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://" className="flex-[2] rounded border border-slate-200 px-2 py-1 text-xs" />
          <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className="text-xs text-rose-500">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...links, { label: "", url: "" }])} className="text-xs text-blue-600 hover:underline">+ Add link</button>
    </div>
  );
}
