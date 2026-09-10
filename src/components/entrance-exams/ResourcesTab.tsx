/**
 * ResourcesTab — the exam-IDENTITY-level "Resources" library editor.
 *
 * Manages exam_resources: year-tagged materials (previous papers, study material, mock
 * tests, sample papers, syllabus PDFs) that are SHARED ACROSS ALL EDITIONS. Lives on the
 * exam editor beside Identity — NOT on an edition — because a 2019 paper belongs to the
 * exam, not to any one cycle. Year is a free field, not constrained to existing editions.
 *
 * All writes go through examResourcesService (URL normalized, revalidation triggered).
 */
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ExternalLink, Eye, EyeOff, Info } from "lucide-react";
import { toast } from "sonner";
import {
  listResources, createResource, updateResource, deleteResource,
  RESOURCE_KINDS, RESOURCE_KIND_LABELS,
  type ExamResource, type ResourceKind, type ResourceInput,
} from "@/services/examResourcesService";
import { getErrorMessage } from "@/lib/utils";

interface ResourcesTabProps {
  examId: string | null; // null while the exam is unsaved (isNew)
}

const EMPTY_FORM: ResourceInput = {
  kind: "previous-paper", year: null, title: "", url: "",
  language: "", stageLabel: "", paperType: "", sourceUrl: "", description: "",
  isPublished: true, displayOrder: 0,
};

export function ResourcesTab({ examId }: ResourcesTabProps) {
  const [resources, setResources] = useState<ExamResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ResourceInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      setResources(await listResources(examId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [examId]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };

  const handleSave = async () => {
    if (!examId) return;
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    if (!form.url.trim()) { toast.error("URL is required."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateResource(editingId, form);
        toast.success("Resource updated.");
      } else {
        await createResource(examId, form);
        toast.success("Resource added.");
      }
      resetForm();
      await load();
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: ExamResource) => {
    setEditingId(r.id);
    setForm({
      kind: r.kind, year: r.year, title: r.title, url: r.url,
      language: r.language ?? "", stageLabel: r.stageLabel ?? "", paperType: r.paperType ?? "",
      sourceUrl: r.sourceUrl ?? "", description: r.description ?? "",
      isPublished: r.isPublished, displayOrder: r.displayOrder,
    });
  };

  const handleDelete = async (r: ExamResource) => {
    if (!confirm(`Delete "${r.title}"? This removes it from the library.`)) return;
    try {
      await deleteResource(r.id);
      toast.success("Resource deleted.");
      await load();
    } catch (err) {
      toast.error("Delete failed: " + getErrorMessage(err));
    }
  };

  const togglePublished = async (r: ExamResource) => {
    try {
      await updateResource(r.id, { isPublished: !r.isPublished });
      await load();
    } catch (err) {
      toast.error("Update failed: " + getErrorMessage(err));
    }
  };

  if (!examId) {
    return (
      <div className="text-sm text-slate-500 py-8 text-center">
        Save the exam first, then add resources here.
      </div>
    );
  }

  // Group by kind for display.
  const byKind = RESOURCE_KINDS.map((k) => ({
    kind: k, label: RESOURCE_KIND_LABELS[k],
    items: resources.filter((r) => r.kind === k),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {/* Level help text — the whole point of putting this at identity level. */}
      <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Shared across all editions.</span> These resources
          belong to the exam itself, not a single cycle. Year is a free field — add a 2019
          paper even if the oldest edition is 2026. The library shows on the main exam page
          and every archived edition page, newest year first.
        </div>
      </div>

      {/* Add / edit form */}
      <div className="rounded-md border border-slate-200 p-4 space-y-3">
        <div className="font-medium text-slate-700">{editingId ? "Edit resource" : "Add a resource"}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Kind</span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as ResourceKind })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {RESOURCE_KINDS.map((k) => <option key={k} value={k}>{RESOURCE_KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Year (free — any year)</span>
            <input
              type="number" value={form.year ?? ""} placeholder="e.g. 2019"
              onChange={(e) => setForm({ ...form, year: e.target.value === "" ? null : parseInt(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm col-span-2">
            <span className="text-slate-600">Title *</span>
            <input
              type="text" value={form.title} placeholder="e.g. SSC CGL 2019 Tier-I Question Paper"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm col-span-2">
            <span className="text-slate-600">URL *</span>
            <input
              type="url" value={form.url} placeholder="https://…/paper.pdf"
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Language</span>
            <input type="text" value={form.language ?? ""} placeholder="English / Hindi"
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Stage label</span>
            <input type="text" value={form.stageLabel ?? ""} placeholder="Tier I / Prelims"
              onChange={(e) => setForm({ ...form, stageLabel: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Paper type</span>
            <input type="text" value={form.paperType ?? ""} placeholder="paper / answer-key"
              onChange={(e) => setForm({ ...form, paperType: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Source URL (provenance)</span>
            <input type="url" value={form.sourceUrl ?? ""} placeholder="where the file came from"
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm col-span-2">
            <span className="text-slate-600">Description</span>
            <textarea value={form.description ?? ""} rows={2}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.isPublished ?? true}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
            <span className="text-slate-600">Published (unpublished resources never show on the site)</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? "Update" : "Add"} resource
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Existing resources, grouped by kind, newest year first */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 size={14} className="animate-spin" /> Loading resources…
        </div>
      ) : byKind.length === 0 ? (
        <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-md">
          No resources yet. Add the first one above.
        </div>
      ) : (
        byKind.map((group) => (
          <div key={group.kind} className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">{group.label}</div>
            <div className="space-y-1.5">
              {group.items.map((r) => (
                <div key={r.id} className={`flex items-center gap-3 rounded border px-3 py-2 text-sm ${r.isPublished ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/40"}`}>
                  <span className="font-mono text-xs text-slate-400 w-12">{r.year ?? "—"}</span>
                  {/* Live/Hidden badge — same language as the rest of the CMS (PillarListPage). */}
                  {r.isPublished ? (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">● Live</span>
                  ) : (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">○ Hidden</span>
                  )}
                  <span className="flex-1 text-slate-700">{r.title}
                    {r.language && <span className="text-slate-400"> · {r.language}</span>}
                    {r.stageLabel && <span className="text-slate-400"> · {r.stageLabel}</span>}
                  </span>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600" title="Open URL"><ExternalLink size={14} /></a>
                  <button type="button" onClick={() => togglePublished(r)} className="text-slate-400 hover:text-slate-700" title={r.isPublished ? "Published — click to unpublish" : "Unpublished — click to publish"}>
                    {r.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button type="button" onClick={() => handleEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button type="button" onClick={() => handleDelete(r)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
