/**
 * SyllabusTab — structured, EXAM-IDENTITY-level syllabus editor (Option A).
 *
 * Shared across all editions (syllabus is stable across cycles; per-cycle changes live as
 * the year's PDF in the Resources library). Per-exam weightage unit chosen once at the top;
 * each subject carries a number in that unit. Weightage entry is disabled until a unit is set.
 *
 * Subjects are drag-reorderable; the order persists to display_order and the frontend renders
 * by it (a syllabus has a natural sequence — Paper I subjects before Paper II, or the order
 * the paper runs). Topics are entered one-per-line (paste-friendly, no delimiter collision)
 * and stored as newline-separated text.
 */
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Info, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  listSubjects, createSubject, updateSubject, deleteSubject, reorderSubjects,
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
      await createSubject(examId, { subject: newSubject.trim(), topics: normalizeTopics(newTopics), weightageValue: wv, displayOrder: subjects.length });
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
      else if (field === "topics") { await updateSubject(id, { topics: normalizeTopics(value) }); }
      await load();
    } catch (err) { toast.error("Update failed: " + getErrorMessage(err)); }
  };

  const remove = async (s: SyllabusSubject) => {
    if (!confirm(`Delete "${s.subject}"?`)) return;
    try { await deleteSubject(s.id); await load(); } catch (err) { toast.error("Delete failed: " + getErrorMessage(err)); }
  };

  // Drag-to-reorder: reorder locally for instant feedback, then persist display_order.
  const onDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...subjects];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSubjects(next);
    setDragIndex(null);
    try { await reorderSubjects(next.map((s) => s.id)); }
    catch (err) { toast.error("Reorder failed: " + getErrorMessage(err)); await load(); }
  };

  if (!examId) return <div className="text-sm text-slate-500 py-8 text-center">Save the exam first, then add syllabus subjects here.</div>;

  const helpBanner = (
    <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
      <Info size={16} className="mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">Shared across all editions.</span> Structured syllabus with
        subject-wise weightage. The syllabus is stable across cycles; a specific year's syllabus PDF
        belongs in the Resources tab, tagged with its year.
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {helpBanner}

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
        <div className="grid grid-cols-12 gap-2 items-start">
          <input className="col-span-4 rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Subject *" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          <textarea className="col-span-5 rounded border border-slate-300 px-2 py-1.5 text-sm min-h-[38px]" rows={1}
            placeholder="Key topics — one per line (optional)" value={newTopics} onChange={(e) => setNewTopics(e.target.value)} />
          <input className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100" type="number" min="0"
            placeholder={weightageType ? WEIGHTAGE_TYPE_LABELS[weightageType] : "unit?"} value={newWeightage}
            onChange={(e) => setNewWeightage(e.target.value)} disabled={!weightageType} title={weightageType ? "" : "Set the weightage unit first"} />
          <button type="button" onClick={addSubject} disabled={saving} className="col-span-1 inline-flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 py-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
        <p className="text-xs text-slate-400">Paste topics straight from the notification — one topic per line.</p>
      </div>

      {/* Subjects list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : subjects.length === 0 ? (
        <div className="text-sm text-slate-500 py-8 px-4 text-center border border-dashed border-slate-200 rounded-md">
          <p className="font-medium text-slate-600">No syllabus yet.</p>
          <p className="mt-1">Add the subjects candidates are tested on, with their key topics and (optionally) weightage.
            This syllabus is shared across every edition of the exam — use the Add subject box above to start.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
            <span className="col-span-4 pl-5">Subject</span><span className="col-span-5">Topics (one per line)</span>
            <span className="col-span-2">Weightage{weightageType ? ` (${WEIGHTAGE_TYPE_LABELS[weightageType]})` : ""}</span><span className="col-span-1" />
          </div>
          {subjects.map((s, index) => (
            <div
              key={s.id}
              className={`grid grid-cols-12 gap-2 items-start rounded ${dragIndex === index ? "opacity-50" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
            >
              <div className="col-span-4 flex items-start gap-1">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => setDragIndex(null)}
                  className="mt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"
                  title="Drag to reorder"
                  aria-label={`Reorder ${s.subject}`}
                >
                  <GripVertical size={14} />
                </button>
                <input className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" defaultValue={s.subject} onBlur={(e) => e.target.value !== s.subject && patch(s.id, "subject", e.target.value)} />
              </div>
              <textarea className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm min-h-[38px]" rows={Math.max(1, (s.topics ?? "").split("\n").length)}
                defaultValue={s.topics ?? ""} placeholder="—" onBlur={(e) => e.target.value !== (s.topics ?? "") && patch(s.id, "topics", e.target.value)} />
              <input className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-100" type="number" min="0" defaultValue={s.weightageValue ?? ""} disabled={!weightageType}
                onBlur={(e) => e.target.value !== String(s.weightageValue ?? "") && patch(s.id, "weightageValue", e.target.value)} />
              <button type="button" onClick={() => remove(s)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center pt-2"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Trim each line, drop blanks, rejoin with newlines. Empty → null (keeps "not filled" clean). */
function normalizeTopics(raw: string): string | null {
  const cleaned = raw.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  return cleaned === "" ? null : cleaned;
}
