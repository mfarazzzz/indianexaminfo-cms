import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  getSarkariNaukriById, createSarkariNaukri, updateSarkariNaukri,
  deleteSarkariNaukri, type SarkariNaukri, type SarkariNaukriInput,
  type RecruitmentType,
} from "@/services/sarkariNaukriService";

export function SarkariNaukriEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Partial<SarkariNaukriInput>>({
    recruitmentType: "direct",
    title: "",
    slug: "",
    organization: "",
    state: "",
    category: "",
    status: "upcoming",
    workflowStatus: "draft",
  });

  useEffect(() => {
    if (!isNew && id) {
      getSarkariNaukriById(id)
        .then((data) => {
          if (!data) { toast.error("Entry not found"); navigate("/sarkari-naukri"); return; }
          setItem(data as any);
        })
        .catch(() => toast.error("Failed to load"))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 255);

  const handleChange = (key: string, value: any) => {
    setItem((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "title" && isNew) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!item.title?.trim()) { toast.error("Title is required"); return; }
    if (!item.slug?.trim()) { toast.error("Slug is required"); return; }
    if (!item.organization?.trim()) { toast.error("Organization is required"); return; }

    setSaving(true);
    try {
      if (isNew) {
        const created = await createSarkariNaukri({
          ...item as SarkariNaukriInput,
          createdBy: user?.id ?? null,
        });
        toast.success("Created successfully");
        navigate(`/sarkari-naukri/${created.id}`);
      } else {
        await updateSarkariNaukri(id!, item);
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this entry permanently?")) return;
    try {
      await deleteSarkariNaukri(id!);
      toast.success("Deleted");
      navigate("/sarkari-naukri");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  const isExam = item.recruitmentType === "exam";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sarkari-naukri")} className="rounded p-1 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Government Job" : "Edit Entry"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handleDelete} className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Recruitment Type Toggle */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Recruitment Type</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleChange("recruitmentType", "exam")}
            className={`flex-1 rounded-lg border-2 p-4 text-center transition ${isExam ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
          >
            <p className="text-lg">📝</p>
            <p className="mt-1 font-medium text-sm">Sarkari Exam</p>
            <p className="text-xs text-slate-500">Written/online competitive exam</p>
          </button>
          <button
            type="button"
            onClick={() => handleChange("recruitmentType", "direct")}
            className={`flex-1 rounded-lg border-2 p-4 text-center transition ${!isExam ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}
          >
            <p className="text-lg">📋</p>
            <p className="mt-1 font-medium text-sm">Sarkari Bharti</p>
            <p className="text-xs text-slate-500">Walk-in / merit / direct recruitment</p>
          </button>
        </div>
      </div>

      {/* Basic Details */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Basic Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
            <input value={item.title ?? ""} onChange={(e) => handleChange("title", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. SSC CGL 2026 Notification" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Slug *</label>
            <input value={item.slug ?? ""} onChange={(e) => handleChange("slug", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Organization *</label>
            <input value={item.organization ?? ""} onChange={(e) => handleChange("organization", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. SSC, UPSC, WCD Bihar" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">State</label>
            <input value={item.state ?? ""} onChange={(e) => handleChange("state", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. uttar-pradesh, all-india" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
            <input value={item.category ?? ""} onChange={(e) => handleChange("category", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. ssc, anganwadi, railway" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
            <input value={item.department ?? ""} onChange={(e) => handleChange("department", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Ministry of Railways" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vacancies</label>
            <input type="number" value={item.vacancyCount ?? ""} onChange={(e) => handleChange("vacancyCount", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 4500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select value={item.status ?? "upcoming"} onChange={(e) => handleChange("status", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="upcoming">Upcoming</option>
              <option value="application-open">Application Open</option>
              <option value="application-closed">Application Closed</option>
              {isExam && <option value="admit-card-released">Admit Card Released</option>}
              {isExam && <option value="exam-scheduled">Exam Scheduled</option>}
              {isExam && <option value="answer-key-released">Answer Key Released</option>}
              {isExam && <option value="result-declared">Result Declared</option>}
              {!isExam && <option value="interview-scheduled">Interview Scheduled</option>}
              {!isExam && <option value="merit-list-released">Merit List Released</option>}
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dates Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Important Dates</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notification Date</label>
            <input type="date" value={item.notificationDate ?? ""} onChange={(e) => handleChange("notificationDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Application Start</label>
            <input type="date" value={item.applicationStartDate ?? ""} onChange={(e) => handleChange("applicationStartDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Application End</label>
            <input type="date" value={item.applicationEndDate ?? ""} onChange={(e) => handleChange("applicationEndDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          {isExam && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Exam Date</label>
                <input type="date" value={item.examDate ?? ""} onChange={(e) => handleChange("examDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Admit Card Date</label>
                <input type="date" value={item.admitCardDate ?? ""} onChange={(e) => handleChange("admitCardDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Answer Key Date</label>
                <input type="date" value={item.answerKeyDate ?? ""} onChange={(e) => handleChange("answerKeyDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          {!isExam && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Interview Date</label>
                <input type="date" value={item.interviewDate ?? ""} onChange={(e) => handleChange("interviewDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Document Verification</label>
                <input type="date" value={item.documentVerificationDate ?? ""} onChange={(e) => handleChange("documentVerificationDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Merit List Date</label>
                <input type="date" value={item.meritListDate ?? ""} onChange={(e) => handleChange("meritListDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Result Date</label>
            <input type="date" value={item.resultDate ?? ""} onChange={(e) => handleChange("resultDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* Links & URLs */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Links</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Application URL</label>
            <input value={item.applicationUrl ?? ""} onChange={(e) => handleChange("applicationUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Official Notification URL</label>
            <input value={item.officialNotificationUrl ?? ""} onChange={(e) => handleChange("officialNotificationUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Result URL</label>
            <input value={item.resultUrl ?? ""} onChange={(e) => handleChange("resultUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
          </div>
          {isExam && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Admit Card URL</label>
              <input value={item.admitCardUrl ?? ""} onChange={(e) => handleChange("admitCardUrl", e.target.value || null)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
          )}
          {!isExam && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Merit List URL</label>
              <input value={item.meritListUrl ?? ""} onChange={(e) => handleChange("meritListUrl", e.target.value || null)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Content & Eligibility</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Eligibility</label>
          <textarea value={item.eligibility ?? ""} onChange={(e) => handleChange("eligibility", e.target.value || null)}
            rows={3} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Education, age, nationality..." />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description (HTML)</label>
          <textarea value={item.description ?? ""} onChange={(e) => handleChange("description", e.target.value || null)}
            rows={8} className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs" placeholder="<h2>Details</h2><p>...</p>" />
        </div>
      </div>

      {/* Publishing */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Publishing</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Workflow Status</label>
            <select value={item.workflowStatus ?? "draft"} onChange={(e) => handleChange("workflowStatus", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isFeatured ?? false} onChange={(e) => handleChange("isFeatured", e.target.checked)} className="h-4 w-4 rounded" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isNew ?? false} onChange={(e) => handleChange("isNew", e.target.checked)} className="h-4 w-4 rounded" />
              New
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isUrgent ?? false} onChange={(e) => handleChange("isUrgent", e.target.checked)} className="h-4 w-4 rounded" />
              Urgent
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
