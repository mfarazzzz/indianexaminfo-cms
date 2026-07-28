/**
 * AI Provider types for multi-provider key management.
 */

export type AIProviderName = "groq" | "gemini" | "cerebras" | "mistral" | "openrouter";

export interface AIProvider {
  id: string;
  provider: AIProviderName;
  label: string;
  apiKey: string;
  model: string;
  isEnabled: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastError: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderInsert {
  provider: AIProviderName;
  label: string;
  apiKey: string;
  model: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIProviderUpdate {
  label?: string;
  apiKey?: string;
  model?: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIRequestLog {
  id: string;
  providerId: string | null;
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
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
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
