/**
 * ColumnBackedCards — R1.1–R1.4: editable cards for column-backed facts.
 *
 * These render in the "Edited here" group of the Modules tab. Each writes to a
 * real database COLUMN (not content_modules) via debounced autosave (R1.5).
 *
 * R1.1 EligibilityCard    → exam_editions.eligibility (qualification, age, nationality)
 * R1.2 ApplicationFeeCard → exam_editions.application_fee (general, obc, ews, sc, st, pwd)
 * R1.3 SelectionProcessCard → exams.selection_process (ordered string[])
 * R1.4 FaqsCard           → exams.faqs (ordered {question, answer}[])
 *
 * Field lists match the frontend renderers EXACTLY (sectionRenderers.tsx):
 *   EligibilitySummary: age, qualification, nationality
 *   ApplicationFeeSummary: general, obc, ews, sc, st, pwd
 *   SelectionProcessSummary: string[] (ordered stages)
 *   FaqsSummary: {question, answer}[]
 */
import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { updateEdition, updateExamIdentity } from "@/services/entranceExamService";
import { useColumnAutosave } from "@/hooks/useColumnAutosave";
import { faqAnswerWarning } from "@/components/shared/FaqAnswerWarning";
import type { ExamIdentity, ExamEdition } from "@/services/entranceExamService";
import type { SaveStatus } from "@/types/modules";

// ── Shared collapsible card shell ───────────────────────────────────────────

interface CardShellProps {
  title: string;
  subtitle?: string;
  forceCollapsed?: boolean;
  status: SaveStatus;
  children: React.ReactNode;
}

function CardShell({ title, subtitle, forceCollapsed, status, children }: CardShellProps) {
  const [open, setOpen] = useState(true);
  useEffect(() => { if (forceCollapsed) setOpen(false); }, [forceCollapsed]);

  return (
    <div className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className="text-sm font-medium text-slate-900">{title}</span>
        {subtitle && <span className="text-xs text-slate-400">— {subtitle}</span>}
        <span className="ml-auto">
          {status === "saving" && <Loader2 size={12} className="animate-spin text-slate-400" />}
          {status === "saved" && <span className="text-[10px] text-green-600 font-medium">Saved</span>}
          {status === "error" && <span className="text-[10px] text-red-600 font-medium">Error</span>}
        </span>
      </button>
      {open && <div className="border-t border-slate-100 px-3 py-3">{children}</div>}
    </div>
  );
}

// ── R1.1: Eligibility Card ──────────────────────────────────────────────────

interface EligibilityCardProps {
  editionId: string | null;
  edition: ExamEdition | null;
  forceCollapsed?: boolean;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
  onPendingChange?: (slug: string, pending: boolean) => void;
}

export function EligibilityCard({ editionId, edition, forceCollapsed, onStatusChange, onPendingChange }: EligibilityCardProps) {
  const [fields, setFields] = useState(() => ({
    qualification: (edition?.eligibility?.qualification as string) ?? "",
    age: (edition?.eligibility?.age as string) ?? "",
    nationality: (edition?.eligibility?.nationality as string) ?? "",
  }));

  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!editionId) return;
    await updateEdition(editionId, { eligibility: data });
  }, [editionId]);

  const { scheduleAutosave, status, pending } = useColumnAutosave(saveFn);

  useEffect(() => { onStatusChange?.("eligibility", status); }, [status, onStatusChange]);
  useEffect(() => { onPendingChange?.("eligibility", pending); }, [pending, onPendingChange]);
  useEffect(() => () => onPendingChange?.("eligibility", false), [onPendingChange]);

  const handleChange = (key: string, value: string) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    scheduleAutosave(updated);
  };

  return (
    <CardShell title="Eligibility" subtitle="edition column" forceCollapsed={forceCollapsed} status={status}>
      <div className="space-y-3">
        <Field label="Educational Qualification" value={fields.qualification} onChange={(v) => handleChange("qualification", v)}
          placeholder="e.g. Graduate with 50% marks" />
        <Field label="Age Limit" value={fields.age} onChange={(v) => handleChange("age", v)}
          placeholder="e.g. 18–35 years as on 01/10/2026" />
        <Field label="Nationality" value={fields.nationality} onChange={(v) => handleChange("nationality", v)}
          placeholder="e.g. Indian citizen only" />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        These are the fields the site renders. Leave blank if not announced.
      </p>
    </CardShell>
  );
}

// ── R1.2: Application Fee Card ──────────────────────────────────────────────

interface ApplicationFeeCardProps {
  editionId: string | null;
  edition: ExamEdition | null;
  forceCollapsed?: boolean;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
  onPendingChange?: (slug: string, pending: boolean) => void;
}

const FEE_CATEGORIES = [
  { key: "general", label: "General / EWS" },
  { key: "obc", label: "OBC-NCL" },
  { key: "ews", label: "EWS (if separate)" },
  { key: "sc", label: "SC" },
  { key: "st", label: "ST" },
  { key: "pwd", label: "PwBD" },
] as const;

export function ApplicationFeeCard({ editionId, edition, forceCollapsed, onStatusChange, onPendingChange }: ApplicationFeeCardProps) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const fee = (edition?.applicationFee ?? {}) as Record<string, number | undefined>;
    const out: Record<string, string> = {};
    for (const { key } of FEE_CATEGORIES) {
      out[key] = fee[key] != null ? String(fee[key]) : "";
    }
    return out;
  });

  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!editionId) return;
    // Convert string values to numbers; omit empty (don't write null for blank fields)
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== "" && v != null) numeric[k] = Number(v);
    }
    await updateEdition(editionId, { applicationFee: numeric });
  }, [editionId]);

  const { scheduleAutosave, status, pending } = useColumnAutosave(saveFn);

  useEffect(() => { onStatusChange?.("application-fee", status); }, [status, onStatusChange]);
  useEffect(() => { onPendingChange?.("application-fee", pending); }, [pending, onPendingChange]);
  useEffect(() => () => onPendingChange?.("application-fee", false), [onPendingChange]);

  const handleChange = (key: string, value: string) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    scheduleAutosave(updated);
  };

  return (
    <CardShell title="Application Fee" subtitle="edition column" forceCollapsed={forceCollapsed} status={status}>
      <div className="grid grid-cols-2 gap-2">
        {FEE_CATEGORIES.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                value={fields[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Enter 0 or leave blank if not applicable. The site merges categories with equal amounts.
      </p>
    </CardShell>
  );
}

// ── R1.3: Selection Process Card ────────────────────────────────────────────

interface SelectionProcessCardProps {
  examId: string | null;
  exam: ExamIdentity | null;
  forceCollapsed?: boolean;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
  onPendingChange?: (slug: string, pending: boolean) => void;
}

export function SelectionProcessCard({ examId, exam, forceCollapsed, onStatusChange, onPendingChange }: SelectionProcessCardProps) {
  const [stages, setStages] = useState<string[]>(() => exam?.selectionProcess ?? []);

  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!examId) return;
    await updateExamIdentity(examId, { selectionProcess: data.stages as string[] });
  }, [examId]);

  const { scheduleAutosave, status, pending } = useColumnAutosave(saveFn);

  useEffect(() => { onStatusChange?.("selection-process", status); }, [status, onStatusChange]);
  useEffect(() => { onPendingChange?.("selection-process", pending); }, [pending, onPendingChange]);
  useEffect(() => () => onPendingChange?.("selection-process", false), [onPendingChange]);

  const update = (next: string[]) => {
    setStages(next);
    scheduleAutosave({ stages: next.filter((s) => s.trim()) });
  };

  return (
    <CardShell title="Selection Process" subtitle="exam column" forceCollapsed={forceCollapsed} status={status}>
      <div className="space-y-1.5">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
            <input
              value={stage}
              onChange={(e) => { const next = [...stages]; next[i] = e.target.value; update(next); }}
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={`Stage ${i + 1}`}
            />
            <button type="button" onClick={() => update(stages.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500 text-xs px-1">✕</button>
            {i > 0 && (
              <button type="button" onClick={() => { const next = [...stages]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; update(next); }}
                className="text-slate-300 hover:text-slate-600 text-xs px-0.5">↑</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => update([...stages, ""])}
        className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">
        + Add stage
      </button>
    </CardShell>
  );
}

// ── R1.4: FAQs Card ─────────────────────────────────────────────────────────

interface FaqsCardProps {
  examId: string | null;
  exam: ExamIdentity | null;
  forceCollapsed?: boolean;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
  onPendingChange?: (slug: string, pending: boolean) => void;
}

type Faq = { question: string; answer: string };

export function FaqsCard({ examId, exam, forceCollapsed, onStatusChange, onPendingChange }: FaqsCardProps) {
  const [faqs, setFaqs] = useState<Faq[]>(() => exam?.faqs ?? []);

  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!examId) return;
    await updateExamIdentity(examId, { faqs: data.faqs as Faq[] });
  }, [examId]);

  const { scheduleAutosave, status, pending } = useColumnAutosave(saveFn);

  useEffect(() => { onStatusChange?.("faqs", status); }, [status, onStatusChange]);
  useEffect(() => { onPendingChange?.("faqs", pending); }, [pending, onPendingChange]);
  useEffect(() => () => onPendingChange?.("faqs", false), [onPendingChange]);

  const update = (next: Faq[]) => {
    setFaqs(next);
    scheduleAutosave({ faqs: next.filter((f) => f.question.trim() || f.answer.trim()) });
  };

  return (
    <CardShell title="FAQs" subtitle="exam column" forceCollapsed={forceCollapsed} status={status}>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded border border-slate-100 p-2 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-slate-400 mt-1.5 shrink-0">Q{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <input
                  value={faq.question}
                  onChange={(e) => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; update(next); }}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm font-medium focus:border-blue-500 focus:outline-none"
                  placeholder="Question"
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; update(next); }}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Answer"
                />
                {(() => {
                  const warn = faqAnswerWarning(faq.answer);
                  return warn ? <p role="note" className="text-xs font-medium text-amber-700">&#9888; {warn}</p> : null;
                })()}
              </div>
              <button type="button" onClick={() => update(faqs.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-500 text-xs mt-1.5">✕</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => update([...faqs, { question: "", answer: "" }])}
        className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">
        + Add FAQ
      </button>
    </CardShell>
  );
}

// ── Shared field input ──────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}
