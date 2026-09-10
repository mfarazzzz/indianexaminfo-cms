/**
 * SyllabusResourcePicker — edition-level picker for the syllabus PDF (Option A).
 *
 * The edition REFERENCES a syllabus-pdf row in the library rather than storing its own
 * copy (one file, one row). This picker lists the exam's syllabus-pdf resources and lets
 * the editor select one — OR add a new one INLINE (year prefilled from the edition) without
 * leaving the edition editor, so the reference model isn't tedious enough to work around.
 */
import { useEffect, useState } from "react";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  listSyllabusPdfs, createResource, type ExamResource,
} from "@/services/examResourcesService";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  examId: string | null;
  editionYear: number | null;
  value: string | null;                 // selected syllabus_resource_id
  onChange: (resourceId: string | null) => void;
}

export function SyllabusResourcePicker({ examId, editionYear, value, onChange }: Props) {
  const [options, setOptions] = useState<ExamResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newYear, setNewYear] = useState<number | null>(editionYear);

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    try { setOptions(await listSyllabusPdfs(examId)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [examId]);
  useEffect(() => { setNewYear(editionYear); }, [editionYear]);

  const handleAddInline = async () => {
    if (!examId) return;
    if (!newTitle.trim() || !newUrl.trim()) { toast.error("Title and URL are required."); return; }
    setSaving(true);
    try {
      // Creates the library row (kind=syllabus-pdf, year prefilled) AND selects it —
      // no leaving the edition editor.
      const created = await createResource(examId, {
        kind: "syllabus-pdf", year: newYear, title: newTitle.trim(), url: newUrl.trim(),
        isPublished: true,
      });
      await load();
      onChange(created.id);
      setAdding(false); setNewTitle(""); setNewUrl("");
      toast.success("Syllabus PDF added to the library and linked to this edition.");
    } catch (err) {
      toast.error("Add failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const selected = options.find((o) => o.id === value) ?? null;

  if (!examId) {
    return <div className="text-sm text-slate-500">Save the exam first to link a syllabus PDF.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={loading}
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— No syllabus PDF linked —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.year ?? "—"} · {o.title}{o.isPublished ? "" : " (hidden)"}
            </option>
          ))}
        </select>
        {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
        {selected && (
          <a href={selected.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600" title="Open PDF">
            <ExternalLink size={15} />
          </a>
        )}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Plus size={13} /> Add new
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Links to a syllabus PDF in the exam's shared library (one file, one row). Adding here
        also adds it to the Resources tab.
      </p>

      {adding && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <input
              type="number" value={newYear ?? ""} placeholder="Year"
              onChange={(e) => setNewYear(e.target.value === "" ? null : parseInt(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="text" value={newTitle} placeholder="Title (e.g. CTET 2024 Syllabus)"
              onChange={(e) => setNewTitle(e.target.value)}
              className="col-span-3 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="url" value={newUrl} placeholder="https://…/syllabus.pdf"
              onChange={(e) => setNewUrl(e.target.value)}
              className="col-span-4 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button" onClick={handleAddInline} disabled={saving}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add & link
            </button>
            <button
              type="button" onClick={() => setAdding(false)}
              className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
