/**
 * AIProviderManager — Complete admin UI for multi-provider AI key management.
 * Includes: provider list, add/edit form, test button, drag-and-drop reorder, health dashboard.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, TestTube2, Loader2, Edit2, Power, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { getAllProviders, createProvider, updateProvider, deleteProvider, updateProviderPriorities, getRecentLogs } from "@/services/aiProviderService";
import { generateWithFallback } from "@/lib/ai/fallbackWrapper";
import type { AIProvider, AIProviderInsert, AIProviderName, AIRequestLog } from "@/types/aiProvider";
import { PROVIDER_LABELS, PROVIDER_MODELS } from "@/types/aiProvider";
import { getErrorMessage } from "@/lib/utils";

function maskKey(key: string): string {
  if (!key || key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 16))}${key.slice(-4)}`;
}

export function AIProviderManager() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [logs, setLogs] = useState<AIRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [provs, recentLogs] = await Promise.all([getAllProviders(), getRecentLogs(10)]);
      setProviders(provs);
      setLogs(recentLogs);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
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
      toast.success("Key deleted.");
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleTest = async (provider: AIProvider) => {
    setTestingId(provider.id);
    try {
      const { OpenAICompatibleAdapter } = await import("@/lib/ai/adapters/openai-compatible");
      const { GeminiAdapter } = await import("@/lib/ai/adapters/gemini");
      const adapter = provider.provider === "gemini" ? new GeminiAdapter() : new OpenAICompatibleAdapter(provider.provider);
      await adapter.generate({ prompt: "Say 'connected' in one word.", apiKey: provider.apiKey, model: provider.model });
      toast.success(`${provider.label}: ✅ Connected`);
      setProviders((prev) => prev.map((p) => p.id === provider.id ? { ...p, lastError: null } : p));
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(`${provider.label}: ❌ ${msg}`);
      setProviders((prev) => prev.map((p) => p.id === provider.id ? { ...p, lastError: msg } : p));
    } finally { setTestingId(null); }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...providers];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setProviders(newOrder);
    await updateProviderPriorities(newOrder.map((p) => p.id)).catch(() => {});
  };

  const handleMoveDown = async (index: number) => {
    if (index === providers.length - 1) return;
    const newOrder = [...providers];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setProviders(newOrder);
    await updateProviderPriorities(newOrder.map((p) => p.id)).catch(() => {});
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Providers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Keys are tried in priority order. If one fails, the next is used automatically.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
          <Plus size={14} /> Add Key
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span>{providers.filter((p) => p.isEnabled).length} enabled / {providers.length} total</span>
        <span>•</span>
        <span>{providers.reduce((s, p) => s + p.usageCount, 0)} total requests served</span>
      </div>

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

              {/* Label + key */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{p.label}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">{maskKey(p.apiKey)}</span>
              </div>

              {/* Model */}
              <span className="text-xs text-slate-500 hidden sm:inline">{p.model}</span>

              {/* Status */}
              {p.lastError ? (
                <span className="text-red-500" title={p.lastError}><AlertCircle size={14} /></span>
              ) : p.lastUsedAt ? (
                <span className="text-green-500" title="Working"><CheckCircle size={14} /></span>
              ) : null}

              {/* Actions */}
              <button onClick={() => handleToggle(p.id, !p.isEnabled)} title={p.isEnabled ? "Disable" : "Enable"}
                className={`p-1.5 rounded ${p.isEnabled ? "text-green-600 hover:bg-green-50" : "text-slate-400 hover:bg-slate-100"}`}>
                <Power size={14} />
              </button>
              <button onClick={() => handleTest(p)} disabled={testingId === p.id} title="Test connection"
                className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                {testingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
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
          <div className="text-center py-8 text-sm text-slate-400">No AI keys configured. Click "Add Key" to get started.</div>
        )}
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-600 mb-2">Recent Requests</h3>
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr><th className="px-2 py-1.5 text-left text-slate-500">Time</th><th className="px-2 py-1.5 text-left text-slate-500">Status</th><th className="px-2 py-1.5 text-left text-slate-500">Latency</th><th className="px-2 py-1.5 text-left text-slate-500">Consumer</th></tr></thead>
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
          onSave={async (data) => {
            if (editingId) {
              await updateProvider(editingId, data);
            } else {
              await createProvider(data as AIProviderInsert);
            }
            setShowForm(false);
            setEditingId(null);
            await load();
            toast.success(editingId ? "Key updated." : "Key added.");
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

// ── Add/Edit Form Modal ────────────────────────────────────────────────────

function ProviderFormModal({ editing, onSave, onCancel }: { editing?: AIProvider; onSave: (data: AIProviderInsert) => Promise<void>; onCancel: () => void }) {
  const [provider, setProvider] = useState<AIProviderName>(editing?.provider ?? "groq");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [apiKey, setApiKey] = useState(editing?.apiKey ?? "");
  const [model, setModel] = useState(editing?.model ?? "llama-3.3-70b-versatile");
  const [saving, setSaving] = useState(false);

  const models = PROVIDER_MODELS[provider] ?? [];

  const handleSubmit = async () => {
    if (!label.trim() || !apiKey.trim()) { toast.error("Label and API key are required."); return; }
    setSaving(true);
    try {
      await onSave({ provider, label: label.trim(), apiKey: apiKey.trim(), model });
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 mx-4">
        <h3 className="font-semibold text-slate-900">{editing ? "Edit AI Key" : "Add AI Key"}</h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
          <select value={provider} onChange={(e) => { setProvider(e.target.value as AIProviderName); setModel(PROVIDER_MODELS[e.target.value as AIProviderName]?.[0]?.value ?? ""); }}
            disabled={!!editing} className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. My Groq Key 1"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="gsk_... or AIza..."
            type="password" className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
            {models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50">
            {saving ? "Saving..." : (editing ? "Update" : "Add Key")}
          </button>
        </div>
      </div>
    </div>
  );
}
