/**
 * SyllabusTab — structured, EXAM-IDENTITY-level syllabus editor (Option A).
 *
 * Shared across all editions (syllabus is stable across cycles; per-cycle changes live as
 * the year's PDF in the Resources library). Per-exam weightage unit chosen once at the top;
 * each subject carries a number in that unit. Weightage entry is disabled until a unit is set.
 */
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Info, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  listSubjects, createSubject, updateSubject, deleteSubject,
  getWeightageType, setWeightageType,
  WEIGHTAGE_TYPES, WEIGHTAGE_TYPE_LABELS,
  type SyllabusSubject, type WeightageType,
} from "@/services/syllabusService";
import { getErrorMessage } from "@/lib/utils";

export function SyllabusTab({ examId }: { examId: string | null }) {
  const [subjects, setSubjects] = useState<SyllabusSubject[]>([]);
  const [weightageType, setWType] = useState<WeightageType | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTopics, setNewTopics] = useState("");
  const [newWeightage, setNewWeightage] = useState("");

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const [subs, wt] = await Promise.all([listSubjects(examId), getWeightageType(examId)]);
      setSubjects(subs); setWType(wt);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [examId]);

  const changeUnit = async (t: WeightageType | null) => {
    if (!examId) return;
    try { await setWeightageType(examId, t); setWType(t); toast.success(t ? `Weightage unit set to ${WEIGHTAGE_TYPE_LABELS[t]}.` : "Weightage unit cleared."); }
    catch (err) { toast.error("Failed: " + getErrorMessage(err)); }
  };

  const addSubject = async () => {
    if (!examId || !newSubject.trim()) { toast.error("Subject name is required."); return; }
    const wv = newWeightage.trim() === "" ? null : Number(newWeightage);
    if (wv != null && (Number.isNaN(wv) || wv < 0)) { toast.error("Weightage must be a non-negative number."); return; }
    if (wv != null && !weightageType) { toast.error("Set the weightage unit above before entering a value."); return; }
    setSaving(true);
    try {
      await createSubject(examId, { subject: newSubject.trim(), topics: newTopics.trim() || null, weightageValue: wv, displayOrder: subjects.length });
      setNewSubject(""); setNewTopics(""); setNewWeightage("");
      await load();
    } catch (err) { toast.error("Add failed: " + getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const patch = async (id: string, field: keyof SyllabusSubject, value: string) => {
    try {
      if (field === "weightageValue") {
        const wv = value.trim() === "" ? null : Number(value);
        if (wv != null && (Number.isNaN(wv) || wv < 0)) { toast.error("Weightage must be a non-negative number."); return; }
        if (wv != null && !weightageType) { toast.error("Set the weightage unit first."); return; }
        await updateSubject(id, { weightageValue: wv });
      } else if (field === "subject") { await updateSubject(id, { subject: value }); }
      else if (field === "topics") { await updateSubject(id, { topics: value || null }); }
      await load();
    } catch (err) { toast.error("Update failed: " + getErrorMessage(err)); }
  };

  const remove = async (s: SyllabusSubject) => {
    if (!confirm(`Delete "${s.subject}"?`)) return;
    try { await deleteSubject(s.id); await load(); } catch (err) { toast.error("Delete failed: " + getErrorMessage(err)); }
  };

  if (!examId) return <div className="text-sm text-slate-500 py-8 text-center">Save the exam first, then add syllabus subjects here.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Shared across all editions.</span> Structured syllabus with
          subject-wise weightage. The syllabus is stable across cycles; a specific year's syllabus PDF
          belongs in the Resources tab, tagged with its year.
        </div>
      </div>

      {/* Per-exam weightage unit — chosen once, applies to every subject. */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600 font-medium">Weightage unit:</span>
        <select
          value={weightageType ?? ""}
          onChange={(e) => changeUnit((e.target.value || null) as WeightageType | null)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Not set —</option>
          {WEIGHTAGE_TYPES.map((t) => <option key={t} value={t}>{WEIGHTAGE_TYPE_LABELS[t]}</option>)}
        </select>
        {!weightageType && <span className="text-xs text-slate-400">Set this to enter subject weightages.</span>}
      </div>

      {/* Add subject */}
      <div className="rounded-md border border-slate-200 p-4 space-y-2">
        <div className="font-medium text-slate-700 text-sm">Add subject</div>
        <div className="grid grid-cols-12 gap-2">
          <input className="col-span-4 rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Subject *" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          <input className="col-span-5 rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Key topics (optional)" value={newTopics} onChange={(e) => setNewTopics(e.target.value)} />
          <input className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100" type="number" min="0"
            placeholder={weightageType ? WEIGHTAGE_TYPE_LABELS[weightageType] : "unit?"} value={newWeightage}
            onChange={(e) => setNewWeightage(e.target.value)} disabled={!weightageType} title={weightageType ? "" : "Set the weightage unit first"} />
          <button type="button" onClick={addSubject} disabled={saving} className="col-span-1 inline-flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      </div>

      {/* Subjects list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : subjects.length === 0 ? (
        <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-md">No subjects yet.</div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
            <span className="col-span-4">Subject</span><span className="col-span-5">Topics</span>
            <span className="col-span-2">Weightage{weightageType ? ` (${WEIGHTAGE_TYPE_LABELS[weightageType]})` : ""}</span><span className="col-span-1" />
          </div>
          {subjects.map((s) => (
            <div key={s.id} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-sm" defaultValue={s.subject} onBlur={(e) => e.target.value !== s.subject && patch(s.id, "subject", e.target.value)} />
              <input className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm" defaultValue={s.topics ?? ""} placeholder="—" onBlur={(e) => e.target.value !== (s.topics ?? "") && patch(s.id, "topics", e.target.value)} />
              <input className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-100" type="number" min="0" defaultValue={s.weightageValue ?? ""} disabled={!weightageType}
                onBlur={(e) => e.target.value !== String(s.weightageValue ?? "") && patch(s.id, "weightageValue", e.target.value)} />
              <button type="button" onClick={() => remove(s)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
