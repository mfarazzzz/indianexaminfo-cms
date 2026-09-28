/**
 * AI Provider types.
 *
 * A provider row is a MODEL SELECTION, not a credential. There is deliberately no
 * apiKey field: a key stored in this table was readable by the browser and shipped
 * inside the built bundle. Keys now live only as Edge Function secrets (AI_KEY_<SLUG>)
 * set by the owner, and the `ai_providers.api_key` / `api_key_encrypted` columns are
 * dropped by supabase/proposed/settings_allow_list_and_key_removal.sql.
 */

export type AIProviderName = "groq" | "gemini" | "cerebras" | "mistral" | "openrouter";

export interface AIProvider {
  id: string;
  provider: AIProviderName;
  label: string;
  model: string;
  isEnabled: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderInsert {
  provider: AIProviderName;
  label: string;
  model: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIProviderUpdate {
  label?: string;
  model?: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIRequestLog {
  id: string;
  providerId: string | null;
  userId: string | null;
  promptHash: string;
  status: "success" | "error";
  errorMessage: string | null;
  latencyMs: number;
  consumerName: string;
  createdAt: string;
}

export const PROVIDER_LABELS: Record<AIProviderName, string> = {
  groq: "Groq",
  gemini: "Google Gemini",
  cerebras: "Cerebras",
  mistral: "Mistral",
  openrouter: "OpenRouter",
};

export const PROVIDER_MODELS: Record<AIProviderName, { value: string; label: string }[]> = {
  groq: [
    { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
    { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Fast)" },
    { value: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B" },
    { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  cerebras: [
    { value: "llama-3.3-70b", label: "Llama 3.3 70B" },
    { value: "llama-3.1-8b", label: "Llama 3.1 8B" },
  ],
  mistral: [
    { value: "mistral-large-latest", label: "Mistral Large" },
    { value: "mistral-small-latest", label: "Mistral Small" },
    { value: "open-mixtral-8x22b", label: "Mixtral 8x22B" },
  ],
  openrouter: [
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  ],
};
