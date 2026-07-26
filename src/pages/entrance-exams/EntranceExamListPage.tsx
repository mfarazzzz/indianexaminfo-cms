import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, GraduationCap, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getEntranceExams, type EntranceExamListItem } from "@/services/entranceExamService";
import { getCategories, type Category } from "@/services/categoryService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteExam } from "@/services/examService";
import { getErrorMessage } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-yellow-100 text-yellow-700",
  "notification-released": "bg-blue-100 text-blue-700",
  "registration-open": "bg-green-100 text-green-700",
  "registration-closed": "bg-red-100 text-red-700",
  "admit-card-released": "bg-purple-100 text-purple-700",
  "exam-conducted": "bg-indigo-100 text-indigo-700",
  "answer-key-released": "bg-cyan-100 text-cyan-700",
  "result-declared": "bg-emerald-100 text-emerald-700",
  counselling: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-500",
};

export function EntranceExamListPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<EntranceExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<EntranceExamListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCategories("entrance-exam").then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: { search?: string; categoryId?: string } = {};
      if (search) opts.search = search;
      if (categoryId) opts.categoryId = categoryId;
      const data = await getEntranceExams(opts);
      setExams(data);
    } catch (err) {
      toast.error("Failed to load entrance exams: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, categoryId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExam(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Entrance Exams</h1>
          <p className="text-sm text-slate-500">{exams.length} exams</p>
        </div>
        <button
          onClick={() => navigate("/entrance-exams/new")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Exam
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Exam Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <GraduationCap size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No entrance exams found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group relative"
              onClick={() => navigate(`/entrance-exams/${exam.id}`)}
            >
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(exam); }}
                className="absolute top-2 right-2 p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete exam"
              >
                <Trash2 size={14} />
              </button>

              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-slate-900 text-sm leading-snug line-clamp-2 pr-6">
                  {exam.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {exam.category.replace(/-/g, " ")}
                </span>
                {exam.currentEdition && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[exam.currentEdition.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {exam.currentEdition.status.replace(/-/g, " ")}
                  </span>
                )}
              </div>

              {exam.currentEdition?.nextDate && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={12} />
                  <span>{exam.currentEdition.nextDate.label}:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(exam.currentEdition.nextDate.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}

              {!exam.currentEdition && (
                <p className="text-xs text-slate-400 italic">No active edition</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Exam"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will permanently remove the exam and all its editions. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleting}
        confirmVariant="danger"
      />
    </div>
  );
}
