import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save, Link as LinkIcon, FileText, Image as ImageIcon } from "lucide-react";
import { getContentPostById, createContentPost, updateContentPost } from "@/services/contentService";
import { searchExams } from "@/services/examService";
import { revalidateAfterModuleSave } from "@/lib/revalidation/revalidationService";
import { RichEditor } from "@/components/shared/RichEditor";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AIAutoFillDialog, AIAutoFillButton } from "@/components/shared/AIAutoFillDialog";
import { autoFillContentPost } from "@/lib/ai/autofill";
import { SlugInput } from "@/components/shared/SlugInput";
import { AISuggestion } from "@/components/shared/AISuggestion";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CONTENT_TYPES } from "@/config/site";
import { usePillars } from "@/hooks/usePillars";
import { CONTENT_TYPE_CONFIGS } from "@/config/contentTypeFields";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { cn, slugify , getErrorMessage } from "@/lib/utils";
import type { ContentType } from "@/types/exam";

const schema = z.object({
  title:           z.string().min(1, "Title required"),
  slug:            z.string().min(1, "Slug required"),
  examId:          z.string().min(1, "Exam required"),
  examEntityName:  z.string(),
  pillar:          z.string().min(1, "Pillar required"),
  contentType:     z.enum(["notification","application","admit-card","date-sheet","syllabus","answer-key","result","cutoff","previous-papers","mock-test","study-material","books"]),
  excerpt:         z.string().max(200).optional(),
  content:         z.string().optional(),
  tags:            z.array(z.string()).default([]),
  status:          z.enum(["draft","review","published","unpublished"]).default("draft"),
  isFeatured:      z.boolean().default(false),
  seoTitle:        z.string().optional(),
  seoDescription:  z.string().optional(),
  // Structured per-content-type fields stored as a flat key-value map
  contentTypeData: z.record(z.unknown()).default({}),
  // Generic quick links (CTAs + official links shown on frontend)
  quickLinks:      z.array(z.object({ label: z.string(), url: z.string(), isPDF: z.boolean(), isOfficial: z.boolean() })).default([]),
  // Attachments: PDF / image / external URL
  attachmentUrls:  z.array(z.object({ label: z.string(), url: z.string(), type: z.enum(["pdf","image","external"]), isOfficial: z.boolean() })).default([]),
  importantDates:  z.array(z.object({ label: z.string(), date: z.string(), isUrgent: z.boolean() })).default([]),
  faqs:            z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});
type FormData = z.infer<typeof schema>;

// ── Special repeatable field components ─────────────────────────────────

/** Fee table: category → amount rows */
function FeeTableField({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const cats = ["general","obc","sc","st","ews","pwd"] as const;
  const labels: Record<string, string> = { general:"General", obc:"OBC-NCL", sc:"SC", st:"ST", ews:"EWS", pwd:"PwBD" };
  return (
    <div className="grid grid-cols-3 gap-2">
      {cats.map((c) => (
        <div key={c}>
          <label className="text-xs text-slate-500 mb-0.5 block">{labels[c]}</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
            <input type="number" min={0} value={value[c] ?? ""}
              onChange={(e) => onChange({ ...value, [c]: Number(e.target.value) })}
              className="w-full rounded border border-slate-200 pl-6 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Paper list: year + title + URL rows */
function PaperListField({ value, onChange }: { value: { year: string; title: string; url: string }[]; onChange: (v: any[]) => void }) {
  const add = () => onChange([...value, { year: "", title: "", url: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => onChange(value.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={p.year} onChange={(e) => update(i, "year", e.target.value)} placeholder="Year" className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <input value={p.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Paper name / set" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <input value={p.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="PDF / page URL" type="url" className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={() => remove(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><Plus size={12} /> Add Paper</button>
    </div>
  );
}

/** Subject list: name + optional URL rows */
function SubjectListField({ value, onChange, urlLabel = "Resource URL" }: { value: { name: string; url?: string }[]; onChange: (v: any[]) => void; urlLabel?: string }) {
  const add = () => onChange([...value, { name: "", url: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => onChange(value.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={s.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Subject / topic name" className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <input value={s.url ?? ""} onChange={(e) => update(i, "url", e.target.value)} placeholder={urlLabel} type="url" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={() => remove(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><Plus size={12} /> Add Row</button>
    </div>
  );
}

/** Cutoff table: category + marks rows */
function CutoffTableField({ value, onChange }: { value: { category: string; marks: string }[]; onChange: (v: any[]) => void }) {
  const add = () => onChange([...value, { category: "", marks: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => onChange(value.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={r.category} onChange={(e) => update(i, "category", e.target.value)} placeholder="e.g. General / UR" className="col-span-6 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <input value={r.marks} onChange={(e) => update(i, "marks", e.target.value)} placeholder="Marks / Score" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={() => remove(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><Plus size={12} /> Add Category</button>
    </div>
  );
}

/** Schedule table: date + subject/paper rows */
function ScheduleTableField({ value, onChange }: { value: { date: string; subject: string }[]; onChange: (v: any[]) => void }) {
  const add = () => onChange([...value, { date: "", subject: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => onChange(value.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input type="date" value={r.date} onChange={(e) => update(i, "date", e.target.value)} className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
          <input value={r.subject} onChange={(e) => update(i, "subject", e.target.value)} placeholder="Subject / Paper" className="col-span-7 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={() => remove(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><Plus size={12} /> Add Date</button>
    </div>
  );
}

// ── Dynamic per-type field renderer ─────────────────────────────────────
function ContentTypeFields({ contentType, value, onChange }: {
  contentType: ContentType;
  value: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  const config = CONTENT_TYPE_CONFIGS[contentType];
  if (!config) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{config.label} Details</h2>
          <p className="text-xs text-slate-500">{config.description}</p>
        </div>
      </div>
      {config.fields.map((field) => {
        const fieldValue = value[field.key];
        return (
          <div key={field.key}>
            <label className="form-label flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.hint && <p className="text-xs text-slate-400 mb-1">{field.hint}</p>}

            {field.type === "text" && (
              <input type="text" value={(fieldValue as string) ?? ""} placeholder={field.placeholder}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
            {field.type === "textarea" && (
              <textarea value={(fieldValue as string) ?? ""} placeholder={field.placeholder} rows={3}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
            {field.type === "url" && (
              <input type="url" value={(fieldValue as string) ?? ""} placeholder={field.placeholder}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
            {field.type === "date" && (
              <input type="date" value={(fieldValue as string) ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
            {field.type === "number" && (
              <input type="number" min={0} value={(fieldValue as number) ?? ""} placeholder={field.placeholder}
                onChange={(e) => onChange(field.key, Number(e.target.value))}
                className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
            {field.type === "boolean" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!fieldValue}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-700">Yes</span>
              </label>
            )}
            {field.type === "select" && field.options && (
              <select value={(fieldValue as string) ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">Select…</option>
                {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {field.type === "fee-table" && (
              <FeeTableField value={(fieldValue as Record<string, number>) ?? {}} onChange={(v) => onChange(field.key, v)} />
            )}
            {field.type === "paper-list" && (
              <PaperListField value={(fieldValue as any[]) ?? []} onChange={(v) => onChange(field.key, v)} />
            )}
            {field.type === "subject-list" && (
              <SubjectListField value={(fieldValue as any[]) ?? []} onChange={(v) => onChange(field.key, v)} />
            )}
            {field.type === "cutoff-table" && (
              <CutoffTableField value={(fieldValue as any[]) ?? []} onChange={(v) => onChange(field.key, v)} />
            )}
            {field.type === "schedule-table" && (
              <ScheduleTableField value={(fieldValue as any[]) ?? []} onChange={(v) => onChange(field.key, v)} />
            )}
          </div>
        );
      })}
    </section>
  );
}

// ── Main page component ──────────────────────────────────────────────────
function ContentEditPageInner() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPublish = usePermission(P.PUBLISH_POST);
  const { data: pillars = [] } = usePillars();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [examSearch, setExamSearch] = useState("");
  const [examResults, setExamResults] = useState<{ id: string; name: string; slug: string; pillar: string; status: string }[]>([]);
  const [examSlug, setExamSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "draft", isFeatured: false, pillar: "sarkari-naukri",
      contentType: "notification", quickLinks: [], attachmentUrls: [],
      importantDates: [], faqs: [], contentTypeData: {},
    },
  });
  const { register, control, watch, setValue, handleSubmit, formState: { errors } } = form;
  const { fields: qlFields,   append: addQL,   remove: removeQL   } = useFieldArray({ control, name: "quickLinks"     });
  const { fields: attFields,  append: addAtt,  remove: removeAtt  } = useFieldArray({ control, name: "attachmentUrls" });
  const { fields: dateFields, append: addDate, remove: removeDate } = useFieldArray({ control, name: "importantDates" });
  const { fields: faqFields,  append: addFaq,  remove: removeFaq  } = useFieldArray({ control, name: "faqs"           });

  const watchedTitle       = watch("title");
  const watchedSlug        = watch("slug");
  const watchedPillar      = watch("pillar");
  const watchedContentType = watch("contentType");
  const watchedCtData      = watch("contentTypeData");

  const handleCtDataChange = useCallback((key: string, val: unknown) => {
    setValue("contentTypeData", { ...watchedCtData, [key]: val });
  }, [watchedCtData, setValue]);

  useEffect(() => {
    if (!id || isNew) return;
    setLoading(true);
    getContentPostById(id).then((post) => {
      if (!post) { navigate("/content"); return; }
      form.reset({
        title: post.title, slug: post.slug, examId: post.examEntityId,
        examEntityName: post.examEntityName, pillar: post.pillar,
        contentType: post.contentType, excerpt: post.excerpt,
        content: post.content, tags: post.tags, status: post.status,
        isFeatured: post.isFeatured, seoTitle: post.seoTitle,
        seoDescription: post.seoDescription, quickLinks: post.quickLinks,
        attachmentUrls: post.attachmentUrls ?? [],
        importantDates: post.importantDates ?? [],
        faqs: post.faqs ?? [],
        contentTypeData: post.contentTypeData ?? {},
      });
      setExamSlug(post.examEntityName.toLowerCase().replace(/\s+/g, "-"));
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  useEffect(() => {
    if (!examSearch || examSearch.length < 2) { setExamResults([]); return; }
    searchExams(examSearch).then(items => setExamResults(items.map(e => ({ id: e.id, name: e.name, slug: e.slug, pillar: e.pillar ?? '', status: e.status }))));
  }, [examSearch]);

  const selectExam = (exam: { id: string; name: string; slug: string; pillar: string }) => {
    setValue("examId", exam.id);
    setValue("examEntityName", exam.name);
    setValue("pillar", exam.pillar);
    setExamSlug(exam.slug);
    setExamSearch("");
    setExamResults([]);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const post = await createContentPost({ ...data, createdBy: user?.id });
        toast.success("Post created!");
        navigate(`/content/${post.id}`, { replace: true });
      } else {
        await updateContentPost(id!, { ...data, updatedBy: user?.id });
        toast.success("Post saved!");
        // Background revalidation — non-blocking
        revalidateAfterModuleSave({ examSlug: examSlug || "exam", pillar: data.pillar, categorySlug: "", contentType: data.contentType });
      }
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  const seoTitleLen = (watch("seoTitle") ?? "").length;
  const seoDescLen  = (watch("seoDescription") ?? "").length;
  const excerptLen  = (watch("excerpt") ?? "").length;
  const ctConfig    = CONTENT_TYPE_CONFIGS[watchedContentType];

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/content")} className="text-slate-400 hover:text-slate-700"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isNew ? "New Content Post" : "Edit Content Post"}
            </h1>
            {ctConfig && <p className="text-xs text-slate-500">{ctConfig.icon} {ctConfig.label}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={watch("status")} />
          <AIAutoFillButton onClick={() => setAiDialogOpen(true)} />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create Post" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── MAIN COLUMN ── */}
        <div className="col-span-2 space-y-5">

          {/* Exam + Content Type selector */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Post Identity</h2>
            {/* Exam search */}
            <div>
              <label className="form-label">Exam *</label>
              <div className="relative">
                <input value={watch("examEntityName") || examSearch}
                  onChange={(e) => { setExamSearch(e.target.value); if (!e.target.value) setValue("examId", ""); }}
                  placeholder="Search exam name…"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                {examResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-slate-200 bg-white shadow-md">
                    {examResults.map((e) => (
                      <button key={e.id} type="button" onClick={() => selectExam(e)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left">
                        <span className="font-medium text-slate-900">{e.name}</span>
                        <span className="text-xs text-slate-400 capitalize">{e.pillar.replace(/-/g, " ")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.examId && <p className="mt-1 text-xs text-red-600">Please select an exam</p>}
            </div>
            {/* Content Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Content Type *</label>
                <select {...register("contentType")}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {CONTENT_TYPE_CONFIGS[t.value]?.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Pillar</label>
                <select {...register("pillar")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  {pillars.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
                </select>
              </div>
            </div>
            {/* Title + Slug */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="form-label mb-0">Title *</label>
                <AISuggestion promptKey="seoTitle" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                  onResult={(v) => setValue("title", v)} label="✨ AI suggest" />
              </div>
              <input {...register("title")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="form-label">Slug *</label>
              <Controller name="slug" control={control} render={({ field }) => (
                <SlugInput value={field.value} onChange={field.onChange} sourceValue={watchedTitle}
                  previewPrefix={`/${watchedPillar}/category/${examSlug || "exam"}/${watchedContentType}/`} />
              )} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">Excerpt (max 200 chars)</label>
                <span className={cn("text-xs", excerptLen > 200 ? "text-red-500" : "text-slate-400")}>{excerptLen}/200</span>
              </div>
              <textarea {...register("excerpt")} rows={2} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </section>

          {/* ── Per-content-type structured fields ── */}
          <ContentTypeFields
            contentType={watchedContentType as ContentType}
            value={watchedCtData}
            onChange={handleCtDataChange}
          />

          {/* Important Dates */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Important Dates</h2>
              <button type="button" onClick={() => addDate({ label: "", date: "", isUrgent: false })}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                <Plus size={12} /> Add Date
              </button>
            </div>
            <div className="space-y-2">
              {dateFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <input {...register(`importantDates.${i}.label`)} placeholder="e.g. Exam Date" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <input {...register(`importantDates.${i}.date`)} type="date" className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" {...register(`importantDates.${i}.isUrgent`)} /> Urgent</label>
                  <button type="button" onClick={() => removeDate(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {dateFields.length === 0 && <p className="text-xs text-slate-400">No dates added.</p>}
            </div>
          </section>

          {/* Attachments: PDF / Image / External URL */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Attachments &amp; External Links</h2>
                <p className="text-xs text-slate-500">PDF downloads, images, or external pages</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => addAtt({ label: "Download PDF", url: "", type: "pdf", isOfficial: true })}
                  className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">
                  <FileText size={11} /> PDF
                </button>
                <button type="button" onClick={() => addAtt({ label: "Image", url: "", type: "image", isOfficial: false })}
                  className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100">
                  <ImageIcon size={11} /> Image
                </button>
                <button type="button" onClick={() => addAtt({ label: "Official Link", url: "", type: "external", isOfficial: true })}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                  <LinkIcon size={11} /> URL
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {attFields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center rounded border border-slate-100 bg-slate-50 p-2">
                  <select {...register(`attachmentUrls.${i}.type`)} className="col-span-2 rounded border border-slate-200 px-1 py-1.5 text-xs focus:outline-none">
                    <option value="pdf">PDF</option>
                    <option value="image">Image</option>
                    <option value="external">URL</option>
                  </select>
                  <input {...register(`attachmentUrls.${i}.label`)} placeholder="Label" className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <input {...register(`attachmentUrls.${i}.url`)} placeholder="https://…" type="url" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <label className="col-span-1 flex items-center gap-0.5 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" {...register(`attachmentUrls.${i}.isOfficial`)} className="h-3.5 w-3.5" /> Offcl
                  </label>
                  <button type="button" onClick={() => removeAtt(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {attFields.length === 0 && <p className="text-xs text-slate-400">No attachments added.</p>}
            </div>
          </section>

          {/* Quick Links (CTA buttons on frontend) */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Quick Links (CTA Buttons)</h2>
                <p className="text-xs text-slate-500">These appear as prominent buttons on the frontend page</p>
              </div>
              <button type="button" onClick={() => addQL({ label: "", url: "", isPDF: false, isOfficial: false })}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                <Plus size={12} /> Add Link
              </button>
            </div>
            <div className="space-y-2">
              {qlFields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                  <input {...register(`quickLinks.${i}.label`)} placeholder="Button label" className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <input {...register(`quickLinks.${i}.url`)} placeholder="https://…" type="url" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <label className="col-span-1 flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" {...register(`quickLinks.${i}.isPDF`)} className="h-3.5 w-3.5" /> PDF</label>
                  <label className="col-span-2 flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" {...register(`quickLinks.${i}.isOfficial`)} className="h-3.5 w-3.5" /> Official</label>
                  <button type="button" onClick={() => removeQL(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Rich text body */}
          <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Full Content (HTML)</h2>
              <AISuggestion promptKey="fullContent" vars={{ examName: watch("examEntityName"), contentType: watchedContentType, year: new Date().getFullYear().toString() }}
                onResult={(html) => setValue("content", html)} label="✨ Generate Article" inline={false} />
            </div>
            <Controller name="content" control={control} render={({ field }) => (
              <RichEditor content={field.value ?? ""} onChange={field.onChange} placeholder="Write or generate full article…" />
            )} />
          </section>

          {/* FAQs */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">FAQs</h2>
              <div className="flex gap-2">
                <AISuggestion promptKey="faqs" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                  onResult={(json) => { try { JSON.parse(json).forEach((f: { question: string; answer: string }) => addFaq(f)); } catch { toast.error("AI returned invalid JSON"); } }}
                  label="✨ Generate" inline={false} />
                <button type="button" onClick={() => addFaq({ question: "", answer: "" })}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            {faqFields.map((field, i) => (
              <div key={field.id} className="mb-3 space-y-1 rounded border border-slate-100 p-3">
                <div className="flex gap-2">
                  <input {...register(`faqs.${i}.question`)} placeholder="Question" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <textarea {...register(`faqs.${i}.answer`)} rows={2} placeholder="Answer" className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            ))}
          </section>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">
          {/* Publish */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Publish</h3>
            <select {...register("status")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
              <option value="draft">Draft</option>
              <option value="review">Submit for Review</option>
              {canPublish && <option value="published">Published</option>}
              {canPublish && <option value="unpublished">Unpublished</option>}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("isFeatured")} className="h-4 w-4 rounded text-blue-600" />
              <span className="text-sm">Featured ⭐</span>
            </label>
            <button type="submit" disabled={saving} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create Post" : "Save Changes"}
            </button>
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">SEO</h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0 text-xs">SEO Title</label>
                <span className={cn("text-xs", seoTitleLen > 60 ? "text-red-500" : "text-slate-400")}>{seoTitleLen}/60</span>
              </div>
              <input {...register("seoTitle")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              <AISuggestion promptKey="seoTitle" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                onResult={(v) => setValue("seoTitle", v)} className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0 text-xs">Meta Description</label>
                <span className={cn("text-xs", seoDescLen > 160 ? "text-red-500" : "text-slate-400")}>{seoDescLen}/160</span>
              </div>
              <textarea {...register("seoDescription")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              <AISuggestion promptKey="metaDescription" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                onResult={(v) => setValue("seoDescription", v)} className="mt-1" />
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="form-label text-xs">Tags (comma-separated)</label>
            <input defaultValue={watch("tags").join(", ")}
              onBlur={(e) => setValue("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* AI Auto-Fill Dialog */}
      <AIAutoFillDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        extractFn={autoFillContentPost}
        title="AI Auto-Fill Content Post"
        placeholder="Paste raw content about an admit card, result, notification, answer key, etc. AI will extract all fields."
        onResult={(data) => {
          const d = data as any;
          if (d.title) setValue("title", d.title);
          if (d.slug) setValue("slug", d.slug);
          if (d.excerpt) setValue("excerpt", d.excerpt);
          if (d.content) setValue("content", d.content);
          if (d.contentType) setValue("contentType", d.contentType);
          if (Array.isArray(d.importantDates)) setValue("importantDates", d.importantDates);
          if (Array.isArray(d.quickLinks)) setValue("quickLinks", d.quickLinks);
          if (d.tags) setValue("tags", d.tags);
          if (d.seoTitle) setValue("seoTitle", d.seoTitle);
          if (d.seoDescription) setValue("seoDescription", d.seoDescription);
          if (Array.isArray(d.faqs)) setValue("faqs", d.faqs);
          if (d.contentTypeData) setValue("contentTypeData", d.contentTypeData);
          toast.success("AI filled all fields! Review and save.");
        }}
      />
    </form>
  );
}

/** Exported component — wrapped in a local ErrorBoundary so a single bad post
 *  doesn't crash the AppShell. The boundary displays a user-friendly recovery UI. */
export function ContentEditPage() {
  return (
    <PageErrorBoundary>
      <ContentEditPageInner />
    </PageErrorBoundary>
  )
}
