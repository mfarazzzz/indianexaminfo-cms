/**
 * AIFillButton — Reusable AI fill trigger for any tab or module.
 * Shows a small dialog to optionally paste raw data, then calls onFill.
 */
import React, { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

interface Props {
  label?: string;
  scope: string; // e.g. "Identity Tab", "SEO Tab", "Overview Module"
  loading?: boolean;
  onFill: (rawContent: string) => Promise<void>;
  variant?: "button" | "icon"; // button = full button, icon = small icon only
}

export function AIFillButton({ label, scope, loading, onFill, variant = "button" }: Props) {
  const [open, setOpen] = useState(false);

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={loading}
          title={`AI Fill ${scope}`}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 font-medium whitespace-nowrap"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          AI Fill
        </button>
        {open && <AIFillModal scope={scope} onFill={onFill} onClose={() => setOpen(false)} loading={loading} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? "Generating..." : (label ?? "AI Fill")}
      </button>
      {open && <AIFillModal scope={scope} onFill={onFill} onClose={() => setOpen(false)} loading={loading} />}
    </>
  );
}

function AIFillModal({ scope, onFill, onClose, loading }: { scope: string; onFill: (raw: string) => Promise<void>; onClose: () => void; loading?: boolean }) {
  const [rawContent, setRawContent] = useState("");

  const handleSubmit = async () => {
    await onFill(rawContent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600" />
            <h3 className="font-semibold text-slate-900">AI Fill — {scope}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Optionally paste raw data to extract information from. Leave empty to generate from exam name only.
        </p>

        <textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          rows={8}
          placeholder="Paste notification text, website content, PDF text, dates, or any raw data here...&#10;&#10;Example:&#10;CAT 2026 Notification Released&#10;Registration: 1 Aug - 15 Sep 2026&#10;Exam Date: 29 Nov 2026&#10;Eligibility: Graduate with 50% marks&#10;Fee: ₹2400 (General), ₹1200 (SC/ST)"
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono leading-relaxed focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
