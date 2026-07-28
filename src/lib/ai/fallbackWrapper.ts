/**
 * fallbackWrapper.ts — Provider-agnostic AI call orchestration.
 *
 * Walks enabled keys in priority order. On retryable errors (429/413/5xx),
 * falls through to the next key. Non-retryable errors (401/403/404) throw immediately.
 * Logs each request for debugging/usage stats (fire-and-forget).
 */
import { getEnabledProviders, recordProviderSuccess, recordProviderError, insertRequestLog } from "@/services/aiProviderService";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible";
import { GeminiAdapter } from "./adapters/gemini";
import { AdapterError } from "./adapters/types";
import type { AIProvider } from "@/types/aiProvider";
import type { ProviderAdapter } from "./adapters/types";

function getAdapter(provider: AIProvider): ProviderAdapter {
  if (provider.provider === "gemini") return new GeminiAdapter();
  return new OpenAICompatibleAdapter(provider.provider);
}

async function hashPrompt(prompt: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  } catch {
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < Math.min(prompt.length, 200); i++) {
      hash = ((hash << 5) - hash + prompt.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }
}

/**
 * Main entry point: generate AI content with automatic fallback.
 */
export async function generateWithFallback(
  prompt: string,
  consumerName: string
): Promise<string> {
  const providers = await getEnabledProviders();

  if (providers.length === 0) {
    throw new Error("No AI providers configured. Add keys in Settings → AI.");
  }

  let lastError: Error | null = null;
  const promptHash = await hashPrompt(prompt);

  for (const provider of providers) {
    const adapter = getAdapter(provider);
    const startTime = Date.now();

    try {
      const response = await adapter.generate({
        prompt,
        apiKey: provider.apiKey,
        model: provider.model,
      });

      const latencyMs = Date.now() - startTime;

      // Record success (fire-and-forget)
      recordProviderSuccess(provider.id).catch(() => {});
      insertRequestLog({
        providerId: provider.id,
        promptHash,
        status: "success",
        errorMessage: null,
        latencyMs,
        consumerName,
      }).catch(() => {});

      return response.content;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof AdapterError ? err : new AdapterError(0, String(err));
      lastError = error;

      // Record error (fire-and-forget)
      recordProviderError(provider.id, error.message).catch(() => {});
      insertRequestLog({
        providerId: provider.id,
        promptHash,
        status: "error",
        errorMessage: error.message,
        latencyMs,
        consumerName,
      }).catch(() => {});

      // Non-retryable: stop immediately
      if (!error.isRetryable) {
        throw error;
      }
      // Retryable: continue to next provider
    }
  }

  throw lastError ?? new Error("All configured AI keys failed. Check Settings → AI.");
}
