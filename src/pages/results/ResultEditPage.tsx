import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, ArrowLeft, Eye, Trash2 } from "lucide-react";
import {
  getResultById, createResult, updateResult, deleteResult,
  type CmsResult, type CmsResultInput,
} from "@/services/resultService";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  title: z.string().min(5, "Title is required (min 5 chars)"),
  titleHindi: z.string().optional().nullable(),
  resultDate: z.string().min(1, "Result date is required"),
  expectedDate: z.string().optional().nullable(),
  organization: z.string().min(2, "Organization is required"),
  organizationHindi: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionHindi: z.string().optional().nullable(),
  resultLink: z.string().url("Must be a valid URL").optional().or(z.literal("")).nullable(),
  totalCandidates: z.coerce.number().optional().nullable(),
  passPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  cutoffMarks: z.string().optional().nullable(),
  resultStatus: z.string().optional().nullable(),
  isNew: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
});

type FormData = z.infer<typeof schema>;

export function ResultEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CmsResult | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: "", title: "", titleHindi: "", resultDate: "",
      expectedDate: "", organization: "", organizationHindi: "",
      category: "", description: "", descriptionHindi: "",
      resultLink: "", totalCandidates: null, passPercentage: null,
      cutoffMarks: "", resultStatus: "declared", isNew: true,
      isFeatured: false, status: "draft",
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      getResultById(id).then((result) => {
        if (!result) { toast.error("Not found"); navigate("/results"); return; }
        setExisting(result);
        form.reset({
          slug: result.slug,
          title: result.title,
          titleHindi: result.titleHindi ?? "",
          resultDate: result.resultDate,
          expectedDate: result.expectedDate ?? "",
          organization: result.organization,
          organizationHindi: result.organizationHindi ?? "",
          category: result.category ?? "",
          description: result.description ?? "",
          descriptionHindi: result.descriptionHindi ?? "",
          resultLink: result.resultLink ?? "",
          totalCandidates: result.totalCandidates,
          passPercentage: result.passPercentage,
          cutoffMarks: result.cutoffMarks ?? "",
          resultStatus: result.resultStatus ?? "declared",
          isNew: result.isNew,
          isFeatured: result.isFeatured,
          status: result.status,
        });
        setLoading(false);
      });
    }
  }, [id, isNew, navigate, form]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const input: CmsResultInput = {
        slug: data.slug,
        title: data.title,
        titleHindi: data.titleHindi || null,
        resultDate: data.resultDate,
        expectedDate: data.expectedDate || null,
        organization: data.organization,
        organizationHindi: data.organizationHindi || null,
        category: data.category || null,
        description: data.description || null,
        descriptionHindi: data.descriptionHindi || null,
        resultLink: data.resultLink || null,
        totalCandidates: data.totalCandidates ?? null,
        passPercentage: data.passPercentage ?? null,
        cutoffMarks: data.cutoffMarks || null,
        resultStatus: data.resultStatus || null,
        isNew: data.isNew ?? false,
        isFeatured: data.isFeatured ?? false,
        status: data.status ?? "draft",
        createdBy: user?.id ?? null,
        createdVia: "cms_editor",
      };

      if (isNew) {
        const created = await createResult(input);
        toast.success("Result created!");
        navigate(`/results/${created.id}`);
      } else {
        await updateResult(id!, input);
        toast.success("Result updated!");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    form.setValue("status", "published");
    form.handleSubmit(onSubmit)();
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm("Delete this result permanently?")) return;
    try {
      await deleteResult(id);
      toast.success("Deleted");
      navigate("/results");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/results")} className="p-2 rounded hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">
            {isNew ? "New Result" : "Edit Result"}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={handlePublish} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium">
            <Eye className="w-3.5 h-3.5" /> Publish
          </button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Basic Information</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input {...form.register("title")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {form.formState.errors.title && <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title (Hindi)</label>
              <input {...form.register("titleHindi")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
              <input {...form.register("slug")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              {form.formState.errors.slug && <p className="text-xs text-red-500 mt-1">{form.formState.errors.slug.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input {...form.register("category")} placeholder="e.g. anganwadi, ssc, railway"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization *</label>
              <input {...form.register("organization")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization (Hindi)</label>
              <input {...form.register("organizationHindi")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </fieldset>

        {/* Dates & Status */}
        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Dates & Status</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Result Date *</label>
              <input type="date" {...form.register("resultDate")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Date</label>
              <input type="date" {...form.register("expectedDate")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Result Status</label>
              <select {...form.register("resultStatus")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                <option value="declared">Declared</option>
                <option value="expected">Expected</option>
                <option value="delayed">Delayed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Result Link</label>
              <input {...form.register("resultLink")} placeholder="https://..." className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Candidates</label>
              <input type="number" {...form.register("totalCandidates")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pass %</label>
              <input type="number" step="0.1" {...form.register("passPercentage")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cutoff Marks</label>
              <input {...form.register("cutoffMarks")} placeholder="General: 95, OBC: 88, SC: 75, ST: 68"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </fieldset>

        {/* Content */}
        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Content</legend>
          <div className="space-y-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (HTML)</label>
              <textarea {...form.register("description")} rows={8}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description Hindi (HTML)</label>
              <textarea {...form.register("descriptionHindi")} rows={4}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </fieldset>

        {/* Flags */}
        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Visibility & Workflow</legend>
          <div className="flex flex-wrap gap-6 mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isNew")} className="rounded" />
              Mark as New
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isFeatured")} className="rounded" />
              Featured
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Workflow Status</label>
              <select {...form.register("status")} className="border border-slate-200 rounded px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Metadata (read-only info) */}
        {existing && (
          <div className="text-xs text-slate-400 border-t pt-4 space-y-1">
            <p>Created: {new Date(existing.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(existing.updatedAt).toLocaleString()}</p>
            <p>Created By: {existing.createdBy ?? "System (legacy import)"}</p>
            {existing.publishedAt && <p>Published: {new Date(existing.publishedAt).toLocaleString()}</p>}
          </div>
        )}
      </form>
    </div>
  );
}
