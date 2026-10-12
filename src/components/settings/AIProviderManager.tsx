/**
 * AIProviderManager — which AI model the CMS uses, in what order.
 *
 * This panel no longer stores keys. A key saved in the `ai_providers` table was
 * readable by the browser under the public read policy and got inlined into the
 * built bundle, so anyone who opened the login page could take it and spend the
 * quota. The key is now an Edge Function secret (`AI_KEY_GROQ` etc.) that only
 * the `ai-fill` function reads; this screen only chooses provider and model and
 * shows the health board the function writes.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, TestTube2, Loader2, Edit2, Power, AlertCircle, CheckCircle, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getAllProviders, createProvider, updateProvider, deleteProvider, updateProviderPriorities, getRecentLogs } from "@/services/aiProviderService";
import { generateTextWithProvider, providerStatus, testProvider, listModels } from "@/lib/ai/aiFillClient";
import { modelLooksRetired, neverSucceeded, modelSuggestions } from "./providerModelBadges";
import type { AIProvider, AIProviderInsert, AIProviderName, AIRequestLog } from "@/types/aiProvider";
import { PROVIDER_LABELS, PROVIDER_MODELS } from "@/types/aiProvider";
import { getErrorMessage } from "@/lib/utils";

/** Secret name the owner must set for a provider - name only, never a value. */
function secretNameFor(provider: AIProviderName): string {
  return `AI_KEY_${provider.toUpperCase()}`;
}

export function AIProviderManager() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [logs, setLogs] = useState<AIRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  // provider slug -> its secret is present (from ai-fill provider_status). null = not loaded yet.
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean> | null>(null);
  const [testingRowId, setTestingRowId] = useState<string | null>(null);
  // S2.13b: provider slug -> its LIVE model ids (from ai-fill list_models). Absent
  // = never fetched, so no retired warning is shown for that provider.
  const [liveModels, setLiveModels] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState<Record<string, boolean>>({});
  const [modelsError, setModelsError] = useState<Record<string, string>>({});

  // Fetch a provider's real model list. Best-effort: an older deployed function
  // without the action returns an error, which we surface per-provider without
  // breaking the screen.
  const refreshModels = useCallback(async (provider: string) => {
    setModelsLoading((m) => ({ ...m, [provider]: true }));
    try {
      const r = await listModels(provider);
      if (r.models.length) {
        setLiveModels((lm) => ({ ...lm, [provider]: r.models.map((x) => x.id) }));
        setModelsError((e) => { const { [provider]: _drop, ...rest } = e; return rest; });
        toast.success(`${r.models.length} live models for ${provider}.`);
      } else {
        setModelsError((e) => ({ ...e, [provider]: r.error ?? "no models returned" }));
      }
    } catch (err) {
      setModelsError((e) => ({ ...e, [provider]: getErrorMessage(err) }));
    } finally {
      setModelsLoading((m) => ({ ...m, [provider]: false }));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [provs, recentLogs] = await Promise.all([getAllProviders(), getRecentLogs(10)]);
      setProviders(provs);
      setLogs(recentLogs);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
    // Key presence comes from the Edge Function (only it can see the secrets).
    // Best-effort: an older deployed function without the action must not break
    // this screen — the badges just stay hidden until v4 is live.
    try { const st = await providerStatus(); const m: Record<string, boolean> = {}; for (const s of st) m[s.provider] = s.keyConfigured; setKeyStatus(m); } catch { setKeyStatus(null); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateProvider(id, { isEnabled: enabled });
      setProviders((prev) => prev.map((p) => p.id === id ? { ...p, isEnabled: enabled } : p));
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
      toast.success("Provider removed.");
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  // One test for the whole chain, not per key: ai-fill walks the enabled rows in
  // priority order itself, so "test this row" would only ever test the first one.
  const handleTest = async () => {
    setTesting(true);
    try {
      const { content, provider, model } = await generateTextWithProvider(
        "Reply with the single word: connected",
        "settings-test",
      );
      toast.success(`AI is working (${provider} / ${model}). Reply: ${content.trim().slice(0, 30)}`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      await load();
    } finally { setTesting(false); }
  };

  // S2.12: test THIS row only — no fallback — so a failure means this provider,
  // not "the first provider the chain happened to reach".
  const handleTestOne = async (id: string) => {
    setTestingRowId(id);
    try {
      const r = await testProvider(id);
      if (r.ok) toast.success(`${r.provider} / ${r.model} responded in ${r.latencyMs}ms${r.sample ? ` (“${r.sample}”)` : ""}`);
      else toast.error(`${r.provider} / ${r.model}: ${r.error ?? "test failed"}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTestingRowId(null); await load(); }
  };

  // Reorder = optimistic flip, then PERSIST. updateProviderPriorities now throws
  // on any failed write (Supabase returns errors as values, not rejections), so a
  // silent no-op is impossible: on failure we roll the order back to what it was
  // and resync to the DB; on success we refetch so the UI shows what the DB holds.
  const commitOrder = async (next: AIProvider[]) => {
    const prev = providers
    setProviders(next)
    try {
      await updateProviderPriorities(next.map((p) => p.id))
      await load()                 // show the DB's truth, not the optimistic order
      toast.success("Order saved.")
    } catch (err) {
      setProviders(prev)           // revert the optimistic flip
      toast.error(getErrorMessage(err))
      await load()                 // resync (the write may have half-applied)
    }
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const next = [...providers]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    void commitOrder(next)
  }

  const handleMoveDown = (index: number) => {
    if (index === providers.length - 1) return
    const next = [...providers]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    void commitOrder(next)
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Providers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Models are tried in this order. If one fails, the next is used automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />} Test AI
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
            <Plus size={14} /> Add model
          </button>
        </div>
      </div>

      {/* Where the key lives now - the value is never shown or entered here. */}
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <KeyRound size={14} className="mt-0.5 shrink-0" />
        <div>
          The secret NAME each provider needs is shown beside it (for example
          <span className="font-mono"> {secretNameFor("groq")}</span>). The owner sets
          that secret in the Supabase dashboard — the CMS never shows or stores the
          value, only whether the server can see it. A provider whose secret is not
          set is skipped, even if it is enabled and first in priority.
        </div>
      </div>

      {/* Stats bar */}
      <div className="text-xs text-slate-500">
        {providers.filter((p) => p.isEnabled).length} enabled / {providers.length} total
      </div>

      {/* S2.12: warn loudly if the server would fall back to none — every enabled
          row's secret is missing. (keyStatus is null until ai-fill v4 is live.) */}
      {keyStatus && providers.some((p) => p.isEnabled) && !providers.some((p) => p.isEnabled && keyStatus[p.provider]) && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" data-testid="ai-no-key-warning">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>No enabled provider has a key set, so AI Fill cannot run. Set the secret
            named next to a provider (for example <span className="font-mono">{secretNameFor("groq")}</span>) in the Supabase dashboard.</div>
        </div>
      )}

      {/* Provider list */}
      <div className="space-y-2">
        {providers.map((p, i) => (
          <div key={p.id} className={`border rounded-lg p-3 transition-colors ${p.isEnabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50"}`}>
            <div className="flex items-center gap-3">
              {/* Priority controls */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30" title="Move up">▲</button>
                <button onClick={() => handleMoveDown(i)} disabled={i === providers.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30" title="Move down">▼</button>
              </div>

              {/* Priority badge */}
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>

              {/* Provider badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                p.provider === "groq" ? "bg-orange-100 text-orange-700" :
                p.provider === "gemini" ? "bg-blue-100 text-blue-700" :
                p.provider === "cerebras" ? "bg-purple-100 text-purple-700" :
                p.provider === "mistral" ? "bg-teal-100 text-teal-700" :
                "bg-pink-100 text-pink-700"
              }`}>{PROVIDER_LABELS[p.provider]}</span>

              {/* S2.12: key presence, straight from the Edge Function. Only shown
                  once provider_status has answered (ai-fill v4+). */}
              {keyStatus && (keyStatus[p.provider]
                ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700" data-testid={`ai-key-set-${p.id}`}>Key set</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700" data-testid={`ai-key-missing-${p.id}`} title={`Set ${secretNameFor(p.provider)} in Supabase`}>Key missing{p.isEnabled ? ", skipped" : ""}</span>
              )}

              {/* Label + secret name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{p.label}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">{secretNameFor(p.provider)}</span>
              </div>

              {/* Model + S2.13b honest badges. Retired = the row's model is not in
                  the last LIVE list we fetched for this provider; never-succeeded
                  = the health columns show no success yet and a 404/model_not_found. */}
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs text-slate-500 font-mono">{p.model}</span>
                {liveModels[p.provider] && modelLooksRetired(p.model, liveModels[p.provider]) && (
                  <span className="text-[10px] text-amber-700" data-testid={`ai-model-retired-${p.id}`}>
                    model not in provider's live list (may be retired)
                  </span>
                )}
                {neverSucceeded(p) && (
                  <span className="text-[10px] text-red-600" data-testid={`ai-never-succeeded-${p.id}`} title={p.lastError ?? ""}>
                    never succeeded
                  </span>
                )}
              </div>

              {/* Status - written by the Edge Function after real calls */}
              {p.lastError ? (
                <span className="text-red-500" title={p.lastError}><AlertCircle size={14} /></span>
              ) : p.lastUsedAt ? (
                <span className="text-green-500" title={`Last used ${new Date(p.lastUsedAt).toLocaleString()}`}><CheckCircle size={14} /></span>
              ) : null}

              {/* Actions */}
              <button onClick={() => handleTestOne(p.id)} disabled={testingRowId === p.id}
                title="Test this provider only (no fallback)"
                className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                {testingRowId === p.id ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
              </button>
              <button onClick={() => handleToggle(p.id, !p.isEnabled)} title={p.isEnabled ? "Disable" : "Enable"}
                className={`p-1.5 rounded ${p.isEnabled ? "text-green-600 hover:bg-green-50" : "text-slate-400 hover:bg-slate-100"}`}>
                <Power size={14} />
              </button>
              <button onClick={() => refreshModels(p.provider)} disabled={modelsLoading[p.provider]}
                title="Refresh this provider's live model list"
                className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                {modelsLoading[p.provider] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
              <button onClick={() => { setEditingId(p.id); setShowForm(true); }} title="Edit"
                className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(p.id, p.label)} title="Delete"
                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </div>
            {p.lastError && <p className="text-[10px] text-red-500 mt-1 ml-12 truncate">{p.lastError}</p>}
          </div>
        ))}
        {providers.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">
            No models listed. The server uses its fallback provider until you add one.
          </div>
        )}
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-600 mb-2">Recent Requests</h3>
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr><th className="px-2 py-1.5 text-left text-slate-500">Time</th><th className="px-2 py-1.5 text-left text-slate-500">Status</th><th className="px-2 py-1.5 text-left text-slate-500">Latency</th><th className="px-2 py-1.5 text-left text-slate-500">Feature</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</td>
                    <td className="px-2 py-1.5"><span className={log.status === "success" ? "text-green-600" : "text-red-600"}>{log.status}</span></td>
                    <td className="px-2 py-1.5 text-slate-500">{log.latencyMs}ms</td>
                    <td className="px-2 py-1.5 text-slate-500">{log.consumerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <ProviderFormModal
          editing={editingId ? providers.find((p) => p.id === editingId) : undefined}
          liveModels={liveModels}
          modelsLoading={modelsLoading}
          onRefreshModels={(prov) => { void refreshModels(prov); }}
          onSave={async (data) => {
            if (editingId) {
              await updateProvider(editingId, data);
            } else {
              await createProvider(data as AIProviderInsert);
            }
            setShowForm(false);
            setEditingId(null);
            await load();
            toast.success(editingId ? "Model updated." : "Model added.");
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

// ── Add/Edit Form Modal ────────────────────────────────────────────────────

function ProviderFormModal({
  editing, onSave, onCancel, liveModels, onRefreshModels, modelsLoading,
}: {
  editing?: AIProvider;
  onSave: (data: AIProviderInsert) => Promise<void>;
  onCancel: () => void;
  liveModels: Record<string, string[]>;
  onRefreshModels: (provider: string) => void;
  modelsLoading: Record<string, boolean>;
}) {
  const [provider, setProvider] = useState<AIProviderName>(editing?.provider ?? "groq");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [model, setModel] = useState(editing?.model ?? "openai/gpt-oss-120b");
  const [saving, setSaving] = useState(false);

  // Suggestions = the provider's LIVE ids when fetched, else the hard-coded map
  // as a fallback. The owner can type ANY id regardless — this is a combobox, not
  // a dropdown, so a brand-new model works before the list is ever refreshed.
  const liveIds = liveModels[provider];
  const suggestions = modelSuggestions(liveIds, PROVIDER_MODELS[provider] ?? []);
  const notInLive = modelLooksRetired(model, liveIds);

  const handleSubmit = async () => {
    if (!label.trim()) { toast.error("A label is required."); return; }
    if (!model.trim()) { toast.error("A model id is required."); return; }
    setSaving(true);
    try {
      await onSave({ provider, label: label.trim(), model: model.trim() });
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 mx-4">
        <h3 className="font-semibold text-slate-900">{editing ? "Edit AI model" : "Add AI model"}</h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
          <select value={provider} onChange={(e) => { setProvider(e.target.value as AIProviderName); setModel(PROVIDER_MODELS[e.target.value as AIProviderName]?.[0]?.value ?? ""); }}
            disabled={!!editing} className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Groq primary"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
          <div className="flex gap-2">
            <input list={`ai-models-${provider}`} value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="type or pick a model id"
              className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm font-mono" />
            <button type="button" onClick={() => onRefreshModels(provider)} disabled={!!modelsLoading[provider]}
              title="Fetch this provider's live model list"
              className="flex items-center gap-1 rounded border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {modelsLoading[provider] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Live
            </button>
          </div>
          {/* datalist gives free text + suggestions in one control. */}
          <datalist id={`ai-models-${provider}`}>
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
          {notInLive && (
            <p className="text-[11px] text-amber-700 mt-1" data-testid="ai-model-typed-warning">
              “{model}” is not in the fetched live list — allowed (it may be new), double-check the id.
            </p>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          No API key field here by design - the server holds keys as secrets
          (<span className="font-mono">{secretNameFor(provider)}</span>).
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50">
            {saving ? "Saving..." : (editing ? "Update" : "Add model")}
          </button>
        </div>
      </div>
    </div>
  );
}
