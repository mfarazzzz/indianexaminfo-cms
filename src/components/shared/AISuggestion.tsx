import React, { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { generateWithGemini } from "@/lib/gemini/client";
import { DEFAULT_PROMPTS, type PromptVars, type PromptKey } from "@/lib/gemini/prompts";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

interface AISuggestionProps {
  promptKey: PromptKey;
  vars: PromptVars;
  onResult: (result: string) => void;
  label?: string;
  className?: string;
  inline?: boolean;
}

export function AISuggestion({
  promptKey,
  vars,
  onResult,
  label,
  className,
  inline = true,
}: AISuggestionProps) {
  const { getSetting } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const apiKey = getSetting("gemini_api_key", "");
    const model = getSetting("gemini_model", "gemini-2.0-flash");
    const enabled = getSetting("ai_enabled", true);

    if (!enabled) {
      setError("AI features are disabled in Settings.");
      return;
    }
    if (!apiKey) {
      setError("No Gemini API key. Configure in Settings → AI.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const promptFn = DEFAULT_PROMPTS[promptKey];
      const prompt = promptFn(vars);
      const result = await generateWithGemini(prompt, apiKey as string, model as string);
      onResult(result.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50",
          inline
            ? "text-purple-600 hover:text-purple-700"
            : "rounded bg-purple-50 px-3 py-1.5 text-purple-700 hover:bg-purple-100"
        )}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Sparkles size={12} />
        )}
        {label || "✨ AI Suggest"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
