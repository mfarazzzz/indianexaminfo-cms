/**
 * AI client — backward-compatible wrapper.
 *
 * Routes through the new multi-provider fallback system (ai_providers table).
 * Falls back to passed key parameters if no providers are configured in the table.
 */
import { generateWithFallback } from "@/lib/ai/fallbackWrapper";
import { getEnabledProviders } from "@/services/aiProviderService";
import { OpenAICompatibleAdapter } from "@/lib/ai/adapters/openai-compatible";
import { GeminiAdapter } from "@/lib/ai/adapters/gemini";
import type { AIProviderName } from "@/types/aiProvider";

/** Strip wrapping quotes that Supabase jsonb may add */
function cleanKey(raw: string): string {
  return (raw ?? "").replace(/^["']|["']$/g, "").trim();
}

/** Detect provider from API key format */
function detectProvider(apiKey: string): AIProviderName {
  if (apiKey.startsWith("gsk_")) return "groq";
  return "gemini";
}

/** Create an AbortController with a timeout */
function createTimeoutController(ms: number): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

/** Default timeout for AI calls: 45 seconds */
const AI_TIMEOUT_MS = 45_000;

/**
 * Main AI generation function.
 *
 * Signature preserved for backward compatibility.
 * Internally routes to the new fallback system when providers are configured.
 */
export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model?: string,
  _fallbackKey?: string,
  _fallbackModel?: string,
  _fallbackKey2?: string
): Promise<string> {
  // Try the new provider system first
  try {
    const providers = await getEnabledProviders();
    if (providers.length > 0) {
      return await generateWithFallback(prompt, "legacy-consumer");
    }
  } catch (err) {
    // If the new system has providers but ALL fail, throw that error
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("All configured AI keys failed") || msg.includes("No AI providers")) {
      // Fall through to legacy
    } else {
      throw err; // Real error from a provider (non-retryable)
    }
  }

  // Fallback: use passed parameters directly (when no providers in table)
  const key = cleanKey(apiKey);
  if (!key) throw new Error("API key not configured. Set it in Settings → AI.");

  const provider = detectProvider(key);
  const finalModel = model || (provider === "groq" ? "openai/gpt-oss-120b" : "gemini-2.5-flash");

  const adapter = provider === "gemini" ? new GeminiAdapter() : new OpenAICompatibleAdapter(provider);
  const response = await adapter.generate({ prompt, apiKey: key, model: finalModel });
  return response.content;
}

/** List available models (for debugging) */
export async function listAvailableModels(apiKey: string): Promise<string[]> {
  const key = cleanKey(apiKey);
  if (!key) return [];
  const provider = detectProvider(key);

  try {
    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id).filter(Boolean);
    } else {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": key },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name?.replace("models/", "") || "")
        .filter(Boolean);
    }
  } catch {
    return [];
  }
}
