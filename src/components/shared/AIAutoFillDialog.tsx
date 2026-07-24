/**
 * AIAutoFillDialog.tsx — Paste raw text, AI fills all form fields.
 * Used across Exam Editor, Content Posts, and Blog Posts.
 */
import React, { useState } from "react";
import { Sparkles, Loader2, X, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { setAutofillApiKey } from "@/lib/ai/autofill";

interface AIAutoFillDialogProps {
  open: boolean;
  onClose: () => void;
  onResult: (data: Record<string, unknown>) => void;
  extractFn: (rawText: string) => Promise<unknown>;
  title?: string;
  placeholder?: string;
}

export function AIAutoFillDialog({
  open,
  onClose,
  onResult,
  extractFn,
  title = "AI Auto-Fill",
  placeholder = "Paste the raw exam notification, official PDF text, or any content here...",
}: AIAutoFillDialogProps) {
  const { getSetting } = useSettings();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleExtract = async () => {
    if (!text.trim()) return;
    
    // Set the API key from settings context before calling extract
    const apiKey = getSetting("gemini_api_key", "") as string;
    if (!apiKey) {
      setError("Gemini API key not configured. Go to Settings → AI and enter your key.");
      return;
    }
    setAutofillApiKey(apiKey);
    
    setLoading(true);
    setError(null);
    try {
      const result = await extractFn(text);
      const parsed = result as Record<string, unknown>;
      if (!parsed || Object.keys(parsed).length === 0) {
        setError("AI returned empty data. Check browser console for details. Try pasting more detailed content.");
        return;
      }
      onResult(parsed);
      onClose();
      setText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI extraction failed. Try again.";
      setError(msg);
      console.error("[AI AutoFill] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setText(clipText);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-600">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">Paste raw content — AI fills all fields automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Raw Content</label>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Clipboard size={12} /> Paste from clipboard
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={12}
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            disabled={loading}
          />
          <p className="text-xs text-slate-400">
            Tip: Copy the entire notification text, exam details page, or official PDF content.
            The more information you provide, the better the auto-fill.
          </p>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleExtract}
            disabled={loading || !text.trim()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all",
              loading
                ? "bg-purple-400 cursor-wait"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25",
              (!text.trim() && !loading) && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Extracting with AI...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Auto-Fill All Fields
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Button that opens the AI AutoFill dialog.
 * Place this in any editor's top bar.
 */
export function AIAutoFillButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-purple-700 hover:to-blue-700 transition-all"
    >
      <Sparkles size={13} />
      AI Auto-Fill
    </button>
  );
}
